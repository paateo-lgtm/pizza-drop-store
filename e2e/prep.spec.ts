import { expect, test } from "@playwright/test";
import { createBookableDrop } from "./support/shop-data";
import { sendPaidEvent } from "./support/webhook";

type TestDrop = Awaited<ReturnType<typeof createBookableDrop>>;

const password = process.env.SEED_PASSWORD ?? "";

test.describe("Vorbereitungsliste", () => {
  let drop: TestDrop;

  test.beforeEach(async ({}, testInfo) => {
    test.skip(!password, "SEED_PASSWORD ist nicht gesetzt");
    test.skip(
      testInfo.project.name === "mobile",
      "Vorbereitung läuft auf Tablet und Desktop",
    );
    drop = await createBookableDrop(`prep-${testInfo.project.name}`);
  });

  test.afterEach(async () => {
    await drop?.cleanup();
  });

  test("zeigt Teiglinge und Pizzen für verkauft und Ausverkauf, Abhaken bleibt", async ({
    page,
    baseURL,
  }) => {
    await page.goto(`/drop/${drop.slug}`);
    for (let i = 0; i < 2; i++) {
      await page.getByRole("button", { name: "Eine Margherita mehr" }).click();
    }
    await page.getByRole("radio").first().locator("..").click();
    await page.getByLabel("Name", { exact: true }).fill("Anna Rossi");
    await page.getByLabel("Telefon", { exact: true }).fill("0171 2345678");
    await page
      .getByLabel("E-Mail", { exact: true })
      .fill(`${drop.emailPrefix}@pizzadrop.test`);
    await page.getByRole("button", { name: "Abholzeit reservieren" }).click();
    await expect(page).toHaveURL(/\/bestellung\//);
    const orderId = new URL(page.url()).pathname.split("/").pop()!;
    await sendPaidEvent(baseURL!, {
      eventId: `evt_${drop.tag}_1`,
      orderId,
      paymentIntentId: `pi_${drop.tag}`,
    });

    const path = `/kitchen/${drop.dropId}/vorbereitung`;
    await page.goto(`/login?next=${encodeURIComponent(path)}`);
    await page.getByLabel("E-Mail").fill("kueche@pizzadrop.test");
    await page.getByLabel("Passwort").fill(password);
    await page.getByRole("button", { name: "Anmelden" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: /Testdrop prep/ }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Drucken" })).toBeVisible();

    // 12 Slots, eine Sorte: Ausverkauf = 12
    const dough = page.getByRole("row", { name: /Teiglinge/ });
    await expect(dough.getByRole("cell").nth(0)).toHaveText("2 Stück");
    await expect(dough.getByRole("cell").nth(1)).toHaveText("12 Stück");
    const margherita = page
      .getByRole("region", { name: "Pizzen" })
      .getByRole("row", { name: /Margherita/ });
    await expect(margherita.getByRole("cell").nth(0)).toHaveText("2 Stück");

    // Abhaken übersteht das Neuladen (auf diesem Gerät)
    await dough.getByRole("checkbox").check();
    await page.reload();
    await expect(
      page.getByRole("row", { name: /Teiglinge/ }).getByRole("checkbox"),
    ).toBeChecked();
  });
});
