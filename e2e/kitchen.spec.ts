import { expect, test, type Browser, type Page } from "@playwright/test";
import { createBookableDrop } from "./support/shop-data";
import { sendPaidEvent } from "./support/webhook";

type TestDrop = Awaited<ReturnType<typeof createBookableDrop>>;

const password = process.env.SEED_PASSWORD ?? "";

/** Reserviert über die Kundenseite und liefert ID und Link der Bestellung. */
async function reserve(page: Page, drop: TestDrop, quantity: number) {
  await page.goto(`/drop/${drop.slug}`);
  for (let i = 0; i < quantity; i++) {
    await page.getByRole("button", { name: "Eine Margherita mehr" }).click();
  }
  await page.getByRole("radio").first().locator("..").click();
  await page.getByLabel("Name", { exact: true }).fill("Anna Rossi");
  await page.getByLabel("Telefon", { exact: true }).fill("0171 2345678");
  await page
    .getByLabel("E-Mail", { exact: true })
    .fill(`${drop.emailPrefix}@pizzadrop.test`);
  await page.getByRole("button", { name: "Abholzeit reservieren" }).click();
  await expect(page).toHaveURL(/\/bestellung\/[^/?]+\?k=/);
  const url = new URL(page.url());
  return {
    orderId: url.pathname.split("/").pop()!,
    link: url.pathname + url.search,
  };
}

/** Ein Küchengerät: eigener Browser-Kontext, als Küche angemeldet, Board offen. */
async function kitchenDevice(browser: Browser, dropId: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`/login?next=${encodeURIComponent(`/kitchen/${dropId}`)}`);
  await page.getByLabel("E-Mail").fill("kueche@pizzadrop.test");
  await page.getByLabel("Passwort").fill(password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByText(/^Küche · Testdrop/)).toBeVisible();
  return { page, close: () => context.close() };
}

const oven = (page: Page) =>
  page.getByRole("region", { name: "Jetzt im Ofen" });
const nextUp = (page: Page) =>
  page.getByRole("region", { name: "Als Nächstes · belegen" });
const ready = (page: Page) => page.getByRole("region", { name: "Abholbereit" });

test.describe("Kitchen-Mode", () => {
  let drop: TestDrop;

  test.beforeEach(async ({}, testInfo) => {
    test.skip(!password, "SEED_PASSWORD ist nicht gesetzt");
    test.skip(
      testInfo.project.name === "mobile",
      "Die Küche läuft auf Tablet und Desktop",
    );
    drop = await createBookableDrop(`kitchen-${testInfo.project.name}`);
  });

  test.afterEach(async () => {
    await drop?.cleanup();
  });

  test("zwei Küchengeräte bleiben synchron, der Kunde sieht den Status", async ({
    browser,
    page,
    baseURL,
  }) => {
    // Zwei Geräte, Polling und Kundenseite: länger als der Standard
    test.setTimeout(120_000);
    const { orderId, link } = await reserve(page, drop, 2);
    const paid = await sendPaidEvent(baseURL!, {
      eventId: `evt_${drop.tag}_1`,
      orderId,
      paymentIntentId: `pi_${drop.tag}`,
    });
    expect(paid.status).toBe(200);

    const a = await kitchenDevice(browser, drop.dropId);
    const b = await kitchenDevice(browser, drop.dropId);
    try {
      await expect(oven(a.page).getByText("Ofen ist frei.")).toBeVisible();
      await expect(nextUp(a.page).getByText("Pizza 1 von 2")).toBeVisible();

      // Gerät A schiebt die erste Pizza in den Ofen, Gerät B sieht es per Polling
      await nextUp(a.page).getByRole("button", { name: "In den Ofen" }).click();
      await expect(oven(a.page).getByText("Pizza 1 von 2")).toBeVisible();
      await expect(oven(b.page).getByText("Pizza 1 von 2")).toBeVisible({
        timeout: 10_000,
      });
      await expect(
        oven(b.page).getByRole("progressbar", { name: "Ofenzeit" }),
      ).toBeVisible();

      // Solange der Ofen belegt ist, wartet die nächste Pizza
      await expect(
        nextUp(b.page).getByRole("button", { name: "In den Ofen" }),
      ).toBeDisabled();

      // Der Kunde sieht „im Ofen“
      await page.goto(link);
      await expect(
        page.getByRole("heading", { name: "Deine Pizzen sind im Ofen." }),
      ).toBeVisible();

      // Gerät B meldet fertig und backt die zweite Pizza
      await oven(b.page).getByRole("button", { name: "Fertig" }).click();
      await expect(oven(b.page).getByText("Ofen ist frei.")).toBeVisible();
      await nextUp(b.page).getByRole("button", { name: "In den Ofen" }).click();
      await expect(oven(b.page).getByText("Pizza 2 von 2")).toBeVisible();
      await oven(b.page).getByRole("button", { name: "Fertig" }).click();

      // Abholbereit auf beiden Geräten und beim Kunden
      await expect(ready(b.page).getByText("Anna Rossi")).toBeVisible();
      await expect(ready(a.page).getByText("Anna Rossi")).toBeVisible({
        timeout: 10_000,
      });
      await page.reload();
      await expect(
        page.getByRole("heading", { name: "Abholbereit!" }),
      ).toBeVisible();

      // Ausgabe an Gerät A
      await ready(a.page).getByRole("button", { name: "Abgeholt" }).click();
      await expect(ready(a.page).getByText(/^Abgeholt: #\d+$/)).toBeVisible();
      await expect(ready(b.page).getByText(/^Abgeholt: #\d+$/)).toBeVisible({
        timeout: 10_000,
      });

      const [order] = await drop.orders();
      expect(order.status).toBe("PICKED_UP");
    } finally {
      await a.close();
      await b.close();
    }
  });
});
