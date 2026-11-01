import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { CRON_TEST_SECRET } from "./support/cron";
import { pool } from "./support/shop-data";

/** Drop-Alarm: Anmeldung, Bestätigung per Knopf, Abmeldung, Cron-Zugang. */
test.describe("Drop-Alarm", () => {
  let email: string;

  test.beforeEach(({}, testInfo) => {
    email = `e2e-alarm-${testInfo.project.name}-${randomUUID().slice(0, 8)}@pizzadrop.test`;
  });

  test.afterEach(async () => {
    await pool.query(`DELETE FROM "EmailLog" WHERE "to" = $1`, [email]);
    await pool.query(`DELETE FROM "Subscriber" WHERE email = $1`, [email]);
  });

  const subscriber = async () => {
    const { rows } = await pool.query<{ status: string; token: string }>(
      `SELECT status, token FROM "Subscriber" WHERE email = $1`,
      [email],
    );
    return rows[0];
  };

  test("anmelden, per Knopf bestätigen und wieder abmelden", async ({
    page,
  }) => {
    await page.goto("/#drop-alarm");
    const form = page.getByRole("region", { name: "Keinen Drop verpassen" });
    await form.getByLabel("E-Mail-Adresse").fill(email);
    await form.getByRole("button", { name: "Drop-Alarm einschalten" }).click();
    await expect(form.getByRole("status")).toHaveText(/Fast geschafft/);
    expect(await subscriber()).toMatchObject({ status: "PENDING" });

    // Öffnen allein bestätigt nichts (Mail-Scanner öffnen Links automatisch)
    const { token } = await subscriber();
    await page.goto(`/alarm/bestaetigen?t=${encodeURIComponent(token)}`);
    expect(await subscriber()).toMatchObject({ status: "PENDING" });
    await page
      .getByRole("button", { name: "Ja, Drop-Alarm einschalten" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Du bist dabei." }),
    ).toBeVisible();
    // Der Schlüssel steht danach nicht mehr in der Adresse
    expect(page.url()).not.toContain(token);
    expect(await subscriber()).toMatchObject({ status: "CONFIRMED" });

    // Erneute Anmeldung verrät nichts
    await page.goto("/#drop-alarm");
    await form.getByLabel("E-Mail-Adresse").fill(email);
    await form.getByRole("button", { name: "Drop-Alarm einschalten" }).click();
    await expect(form.getByRole("status")).toHaveText(/Fast geschafft/);

    await page.goto(`/alarm/abmelden?t=${encodeURIComponent(token)}`);
    await page.getByRole("button", { name: "Abmelden" }).click();
    await expect(
      page.getByRole("heading", { name: "Du bist abgemeldet." }),
    ).toBeVisible();
    expect(await subscriber()).toMatchObject({ status: "UNSUBSCRIBED" });
  });

  test("ein falscher Link zeigt einen Hinweis statt eines Knopfs", async ({
    page,
  }) => {
    await page.goto("/alarm/bestaetigen?t=falsch-aber-lang-genug-1234567");
    await page
      .getByRole("button", { name: "Ja, Drop-Alarm einschalten" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Dieser Link gilt nicht mehr." }),
    ).toBeVisible();
  });

  test("One-Click-Abmeldung nur per POST", async ({ request }) => {
    await pool.query(
      `INSERT INTO "Subscriber" (id, email, status, token, "confirmedAt")
       VALUES ($1, $2, 'CONFIRMED', $3, now())`,
      [randomUUID(), email, `tok-${randomUUID()}`],
    );
    const { token } = await subscriber();
    const path = `/api/alarm/abmelden?t=${encodeURIComponent(token)}`;
    expect((await request.get(path)).status()).toBe(405);
    expect(await subscriber()).toMatchObject({ status: "CONFIRMED" });
    expect((await request.post(path)).status()).toBe(200);
    expect(await subscriber()).toMatchObject({ status: "UNSUBSCRIBED" });
  });

  test("der Cron-Endpunkt verlangt den Schlüssel", async ({ request }) => {
    expect((await request.get("/api/cron/drop-alarm")).status()).toBe(401);
    const wrong = await request.get("/api/cron/drop-alarm", {
      headers: { Authorization: "Bearer falsch" },
    });
    expect(wrong.status()).toBe(401);
    const ok = await request.get("/api/cron/drop-alarm", {
      headers: { Authorization: `Bearer ${CRON_TEST_SECRET}` },
    });
    expect(ok.status()).toBe(200);
    expect(await ok.json()).toEqual({
      sent: expect.any(Number),
      remaining: expect.any(Number),
    });
  });
});
