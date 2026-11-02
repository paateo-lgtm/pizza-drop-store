import { expect, test } from "@playwright/test";
import { createBookableDrop, pool } from "./support/shop-data";

// Test-Account aus prisma/seed.ts; das Passwort kommt aus SEED_PASSWORD (.env bzw. CI).
const password = process.env.SEED_PASSWORD ?? "";

/** Reporting: Dashboard mit Filter, Drop-Bericht, CSV-Export nur angemeldet. */
test.describe("Reporting", () => {
  test("CSV-Export ohne Anmeldung leitet zum Login", async ({ request }) => {
    const response = await request.get("/admin/reporting/export", {
      maxRedirects: 0,
    });
    expect([303, 307]).toContain(response.status());
    expect(response.headers().location).toMatch(/\/login/);
  });

  test("Admin sieht Kennzahlen, Drop-Bericht und lädt das CSV", async ({
    page,
  }, testInfo) => {
    test.skip(!password, "SEED_PASSWORD ist nicht gesetzt");
    const drop = await createBookableDrop(`report-${testInfo.project.name}`);
    try {
      await page.goto(`/drop/${drop.slug}`);
      await page.getByRole("button", { name: "Eine Margherita mehr" }).click();
      await page.getByRole("radio").first().locator("..").click();
      await page.getByLabel("Name", { exact: true }).fill("Anna Rossi");
      await page.getByLabel("Telefon", { exact: true }).fill("0171 2345678");
      await page
        .getByLabel("E-Mail", { exact: true })
        .fill(`${drop.emailPrefix}-r@pizzadrop.test`);
      await page.getByRole("button", { name: "Abholzeit reservieren" }).click();
      await expect(page).toHaveURL(/\/bestellung\//);
      await pool.query(
        `UPDATE "Order" SET status = 'PICKED_UP', "paidAt" = now() WHERE "dropId" = $1`,
        [drop.dropId],
      );

      await page.goto(
        `/login?next=${encodeURIComponent(`/admin/reporting?drop=${drop.dropId}`)}`,
      );
      await page.getByLabel("E-Mail").fill("admin@pizzadrop.test");
      await page.getByLabel("Passwort").fill(password);
      await page.getByRole("button", { name: "Anmelden" }).click();
      await expect(page).toHaveURL(/\/admin\/reporting\?drop=/);

      const orders = page
        .getByRole("term")
        .filter({ hasText: /^Bestellungen$/ })
        .locator("..");
      await expect(orders).toContainText("1");
      await expect(
        page.getByRole("cell", { name: "Margherita", exact: true }),
      ).toBeVisible();

      const csv = await page.request.get(
        `/admin/reporting/export?drop=${drop.dropId}`,
      );
      expect(csv.status()).toBe(200);
      expect(csv.headers()["content-type"]).toContain("text/csv");
      const body = await csv.text();
      expect(body.charCodeAt(0)).toBe(0xfeff);
      expect(body).toContain("Margherita");
      expect(body).not.toContain("Anna Rossi");

      await page.goto(`/admin/reporting/drops/${drop.dropId}`);
      await expect(
        page.getByRole("heading", { name: "Verkaufsverlauf" }),
      ).toBeVisible();
      await expect(
        page.getByRole("img", { name: /Verkaufsverlauf: 1 von/ }),
      ).toBeVisible();
    } finally {
      await drop.cleanup();
    }
  });
});
