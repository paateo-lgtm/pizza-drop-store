import { expect, test, type Page } from "@playwright/test";
import { createBookableDrop } from "./support/shop-data";
import { sendPaidEvent } from "./support/webhook";

type TestDrop = Awaited<ReturnType<typeof createBookableDrop>>;

const password = process.env.SEED_PASSWORD ?? "";

/** Reserviert eine Pizza über die Kundenseite und liefert ID und Link der Bestellung. */
async function reserve(page: Page, drop: TestDrop, email: string) {
  await page.goto(`/drop/${drop.slug}`);
  await page.getByRole("button", { name: "Eine Margherita mehr" }).click();
  await page.getByRole("radio").first().locator("..").click();
  await page.getByLabel("Name", { exact: true }).fill("Anna Rossi");
  await page.getByLabel("Telefon", { exact: true }).fill("0171 2345678");
  await page.getByLabel("E-Mail", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Abholzeit reservieren" }).click();
  await expect(page).toHaveURL(/\/bestellung\/[^/?]+\?k=/);
  const url = new URL(page.url());
  return {
    orderId: url.pathname.split("/").pop()!,
    link: url.pathname + url.search,
  };
}

test.describe("Zahlung", () => {
  let drop: TestDrop;

  test.beforeEach(async ({}, testInfo) => {
    drop = await createBookableDrop(`pay-${testInfo.project.name}`);
  });

  test.afterEach(async () => {
    await drop.cleanup();
  });

  test("nach dem Zahlungs-Webhook zeigt die Bestellseite Abholcode und QR-Code", async ({
    page,
    baseURL,
  }) => {
    const { orderId, link } = await reserve(
      page,
      drop,
      `${drop.emailPrefix}-a@pizzadrop.test`,
    );

    // Rückkehr von Stripe, bevor der Webhook da ist
    await page.goto(`${link}&bezahlt=1`);
    await expect(
      page.getByRole("heading", { name: "Zahlung wird bestätigt …" }),
    ).toBeVisible();

    const response = await sendPaidEvent(baseURL!, {
      eventId: `evt_${drop.tag}_1`,
      orderId,
      paymentIntentId: `pi_${drop.tag}`,
    });
    expect(response.status).toBe(200);
    // Doppelte Zustellung bleibt folgenlos
    const again = await sendPaidEvent(baseURL!, {
      eventId: `evt_${drop.tag}_1`,
      orderId,
      paymentIntentId: `pi_${drop.tag}`,
    });
    expect(await again.json()).toMatchObject({ result: "duplicate" });

    // Die Seite lädt sich selbst neu
    await expect(
      page.getByRole("heading", { name: "Bezahlt – wir backen für dich." }),
    ).toBeVisible({ timeout: 10_000 });
    const code = page.getByRole("region", { name: "Abholcode" });
    await expect(code.getByRole("img", { name: /QR-Code/ })).toBeVisible();
    await expect(code.getByText(/^[A-Z2-9]{6}$/)).toBeVisible();

    const [order] = await drop.orders();
    expect(order).toMatchObject({ status: "PAID", seqs: [1] });
  });

  test("ein unsigniertes Event wird abgelehnt", async ({ baseURL }) => {
    const response = await fetch(`${baseURL}/api/stripe/webhook`, {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=falsch" },
      body: "{}",
    });
    expect(response.status).toBe(400);
  });

  test("der Admin storniert eine offene Reservierung", async ({ page }) => {
    test.skip(!password, "SEED_PASSWORD ist nicht gesetzt");
    const { orderId } = await reserve(
      page,
      drop,
      `${drop.emailPrefix}-b@pizzadrop.test`,
    );

    await page.goto(
      `/login?next=${encodeURIComponent(`/admin/bestellungen/${orderId}`)}`,
    );
    await page.getByLabel("E-Mail").fill("admin@pizzadrop.test");
    await page.getByLabel("Passwort").fill(password);
    await page.getByRole("button", { name: "Anmelden" }).click();
    await expect(
      page.getByRole("heading", { name: /^Bestellung \d+$/ }),
    ).toBeVisible();
    await expect(page.getByText("Zahlung offen")).toBeVisible();

    await page.getByRole("button", { name: "Stornieren" }).click();
    await page.getByLabel("Grund (intern, optional)").fill("E2E-Test");
    await page
      .getByRole("button", { name: "Stornieren", exact: true })
      .last()
      .click();
    await expect(page.getByText("Reservierung storniert.")).toBeVisible();
    await expect(page.getByText("Storniert", { exact: true })).toBeVisible();

    const [order] = await drop.orders();
    expect(order).toMatchObject({ status: "CANCELLED", seqs: null });
  });
});
