import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createBookableDrop, pool } from "./support/shop-data";

// Test-Account aus prisma/seed.ts; das Passwort kommt aus SEED_PASSWORD (.env bzw. CI).
const password = process.env.SEED_PASSWORD ?? "";

const deleteCoupon = (code: string) =>
  pool.query(`DELETE FROM "Coupon" WHERE code = $1`, [code]);

/** Gutscheine: Anlegen im Admin, Einlösen im Checkout. */
test.describe("Gutscheine", () => {
  let code: string;

  test.beforeEach(({}, testInfo) => {
    code =
      `E2E-${testInfo.project.name}-${randomUUID().slice(0, 6)}`.toUpperCase();
  });

  test("Admin legt einen Gutschein an", async ({ page }) => {
    test.skip(!password, "SEED_PASSWORD ist nicht gesetzt");
    try {
      await page.goto(
        `/login?next=${encodeURIComponent("/admin/gutscheine/neu")}`,
      );
      await page.getByLabel("E-Mail").fill("admin@pizzadrop.test");
      await page.getByLabel("Passwort").fill(password);
      await page.getByRole("button", { name: "Anmelden" }).click();
      await expect(page).toHaveURL(/\/admin\/gutscheine\/neu$/);

      await page.getByLabel("Code", { exact: true }).fill(code.toLowerCase());
      await page.getByLabel("Art").selectOption("FIXED");
      await page.getByLabel("Rabatt in €").fill("3,50");
      await page.getByRole("button", { name: "Speichern" }).click();

      await expect(page).toHaveURL(/\/admin\/gutscheine$/);
      const row = page.getByRole("link", { name: new RegExp(code) });
      await expect(row).toContainText("3,50");
      await expect(row).toContainText("aktiv");
    } finally {
      await deleteCoupon(code);
    }
  });

  test("Kunde löst einen Gutschein im Checkout ein", async ({
    page,
  }, testInfo) => {
    const drop = await createBookableDrop(`gutschein-${testInfo.project.name}`);
    await pool.query(
      `INSERT INTO "Coupon" (id, code, type, value) VALUES ($1, $2, 'PERCENT', 10)`,
      [randomUUID(), code],
    );
    try {
      await page.goto(`/drop/${drop.slug}`);
      const more = page.getByRole("button", { name: "Eine Margherita mehr" });
      await more.click();
      await more.click();
      await page.getByRole("radio").first().locator("..").click();
      await fill(page, `${drop.emailPrefix}-g@pizzadrop.test`);

      // Unbekannter Code: Fehler am Feld, keine Reservierung
      await page.getByLabel("Gutscheincode (optional)").fill("GIBTS-NICHT");
      await page.getByRole("button", { name: "Abholzeit reservieren" }).click();
      await expect(
        page.getByText("Diesen Gutscheincode kennen wir nicht."),
      ).toBeVisible();
      expect(await drop.orders()).toEqual([]);

      await page
        .getByLabel("Gutscheincode (optional)")
        .fill(code.toLowerCase());
      await page.getByRole("button", { name: "Abholzeit reservieren" }).click();
      await expect(page).toHaveURL(/\/bestellung\/[^/?]+\?k=/);
      const order = page.getByRole("article");
      await expect(order.getByText("Gutschein", { exact: true })).toBeVisible();
      await expect(order.getByText("−2,10 €")).toBeVisible();
      await expect(order.getByText("18,90 €").first()).toBeVisible();
      expect(await drop.orders()).toEqual([
        expect.objectContaining({
          status: "PENDING_PAYMENT",
          totalCents: 1890,
        }),
      ]);
    } finally {
      await drop.cleanup();
      await deleteCoupon(code);
    }
  });
});

async function fill(page: Page, email: string) {
  await page.getByLabel("Name", { exact: true }).fill("Anna Rossi");
  await page.getByLabel("Telefon", { exact: true }).fill("0171 2345678");
  await page.getByLabel("E-Mail", { exact: true }).fill(email);
}
