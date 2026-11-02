import { expect, test } from "@playwright/test";
import { feedbackKey } from "../src/lib/booking/order-link";
import { CRON_TEST_SECRET } from "./support/cron";
import { createBookableDrop, pool } from "./support/shop-data";

/** Feedback nach Abholung: Bewerten per persönlichem Link, Widerspruch, Cron-Zugang. */
test.describe("Feedback", () => {
  let drop: Awaited<ReturnType<typeof createBookableDrop>>;
  let orderId: string;

  test.beforeEach(async ({ page }, testInfo) => {
    drop = await createBookableDrop(`feedback-${testInfo.project.name}`);
    // Bestellen mit Einwilligung, dann als abgeholt markieren
    await page.goto(`/drop/${drop.slug}`);
    await page.getByRole("button", { name: "Eine Margherita mehr" }).click();
    await page.getByRole("radio").first().locator("..").click();
    await page.getByLabel("Name", { exact: true }).fill("Anna Rossi");
    await page.getByLabel("Telefon", { exact: true }).fill("0171 2345678");
    await page
      .getByLabel("E-Mail", { exact: true })
      .fill(`${drop.emailPrefix}-f@pizzadrop.test`);
    await page.getByLabel(/um eine kurze Bewertung gebeten/).check();
    await page.getByRole("button", { name: "Abholzeit reservieren" }).click();
    await expect(page).toHaveURL(/\/bestellung\//);
    const { rows } = await pool.query<{ id: string; feedbackConsent: boolean }>(
      `UPDATE "Order" SET status = 'PICKED_UP', "pickedUpAt" = now() - interval '4 hours'
       WHERE "dropId" = $1 RETURNING id, "feedbackConsent"`,
      [drop.dropId],
    );
    expect(rows[0].feedbackConsent).toBe(true);
    orderId = rows[0].id;
  });

  test.afterEach(async () => {
    await drop.cleanup();
  });

  test("bewerten per Link, danach ist die Bewertung erledigt", async ({
    page,
  }) => {
    const path = `/feedback/${orderId}?k=${feedbackKey(orderId)}`;
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Wie war deine Pizza?" }),
    ).toBeVisible();
    // Die Radios sind nur für Screenreader sichtbar; geklickt wird wie vom Nutzer aufs Label.
    await page
      .getByRole("radio", { name: "4 Sterne – Sehr gut" })
      .locator("..")
      .click();
    await expect(
      page.getByRole("radio", { name: "4 Sterne – Sehr gut" }),
    ).toBeChecked();
    await page.getByLabel("Kommentar (optional)").fill("Knuspriger Rand!");
    await page.getByRole("button", { name: "Bewertung senden" }).click();
    await expect(
      page.getByRole("heading", { name: "Danke dir!" }),
    ).toBeVisible();

    const { rows } = await pool.query(
      `SELECT rating, comment FROM "Feedback" WHERE "orderId" = $1`,
      [orderId],
    );
    expect(rows).toEqual([{ rating: 4, comment: "Knuspriger Rand!" }]);

    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Danke, deine Bewertung ist da." }),
    ).toBeVisible();
  });

  test("ein fremder Schlüssel öffnet nichts", async ({ page }) => {
    await page.goto(`/feedback/${orderId}?k=falsch-aber-lang-genug-123456`);
    await expect(
      page.getByRole("heading", { name: "Dieser Link gilt nicht." }),
    ).toBeVisible();
  });

  test("Widerspruch per Knopf nimmt die Einwilligung zurück", async ({
    page,
  }) => {
    const key = feedbackKey(orderId);
    await page.goto(`/feedback/${orderId}/abmelden?k=${key}`);
    await page.getByRole("button", { name: "Keine Anfragen mehr" }).click();
    await expect(
      page.getByRole("heading", { name: "Erledigt." }),
    ).toBeVisible();
    expect(page.url()).not.toContain(key);
    const { rows } = await pool.query(
      `SELECT "feedbackConsent" FROM "Order" WHERE id = $1`,
      [orderId],
    );
    expect(rows).toEqual([{ feedbackConsent: false }]);
  });

  test("der Cron-Endpunkt verlangt den Schlüssel", async ({ request }) => {
    expect((await request.get("/api/cron/feedback")).status()).toBe(401);
    const ok = await request.get("/api/cron/feedback", {
      headers: { Authorization: `Bearer ${CRON_TEST_SECRET}` },
    });
    const run = await ok.json();
    expect(ok.status()).toBe(run.skipped > 0 ? 503 : 200);
  });
});
