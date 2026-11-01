import { expect, test } from "@playwright/test";
import { CRON_TEST_SECRET } from "./support/cron";
import { createBookableDrop, pool } from "./support/shop-data";

/** Warteliste: Eintragen bei ausverkauftem Drop, Austragen per Knopf, Cron-Zugang. */
test.describe("Warteliste", () => {
  let drop: Awaited<ReturnType<typeof createBookableDrop>>;

  test.beforeEach(async ({}, testInfo) => {
    drop = await createBookableDrop(`warte-${testInfo.project.name}`, 2);
    // Alle Slots gesperrt: Der Drop gilt als ausverkauft
    await pool.query(
      `UPDATE "Slot" SET state = 'BLOCKED' WHERE "dropId" = $1`,
      [drop.dropId],
    );
  });

  test.afterEach(async () => {
    await drop.cleanup();
  });

  const entry = async (email: string) => {
    const { rows } = await pool.query<{ quantity: number; token: string }>(
      `SELECT quantity, token FROM "WaitlistEntry" WHERE "dropId" = $1 AND email = $2`,
      [drop.dropId, email],
    );
    return rows[0];
  };

  test("eintragen und per Knopf wieder austragen", async ({ page }) => {
    const email = `${drop.emailPrefix}@pizzadrop.test`;
    await page.goto(`/drop/${drop.slug}`);
    await expect(
      page.getByRole("heading", { name: "Ausverkauft" }),
    ).toBeVisible();

    const form = page.getByRole("form", { name: "Auf die Warteliste" });
    await form.getByLabel("E-Mail-Adresse").fill(email.toUpperCase());
    await form.getByLabel("Anzahl").selectOption("2");
    await form.getByRole("button", { name: "Eintragen" }).click();
    await expect(form.getByRole("status")).toHaveText(
      /Du stehst auf der Warteliste/,
    );
    expect(await entry(email)).toMatchObject({ quantity: 2 });

    // Öffnen allein trägt nicht aus (Mail-Scanner öffnen Links automatisch)
    const { token } = await entry(email);
    await page.goto(`/warteliste/austragen?t=${encodeURIComponent(token)}`);
    expect(await entry(email)).toBeDefined();
    await page.getByRole("button", { name: "Austragen" }).click();
    await expect(
      page.getByRole("heading", { name: "Du bist ausgetragen." }),
    ).toBeVisible();
    expect(page.url()).not.toContain(token);
    expect(await entry(email)).toBeUndefined();
  });

  test("der Cron-Endpunkt verlangt den Schlüssel", async ({ request }) => {
    expect((await request.get("/api/cron/warteliste")).status()).toBe(401);
    const ok = await request.get("/api/cron/warteliste", {
      headers: { Authorization: `Bearer ${CRON_TEST_SECRET}` },
    });
    const run = await ok.json();
    expect(run).toEqual({
      sent: expect.any(Number),
      skipped: expect.any(Number),
      failed: expect.any(Number),
      remaining: expect.any(Number),
    });
    expect(ok.status()).toBe(run.skipped > 0 ? 503 : 200);
  });
});
