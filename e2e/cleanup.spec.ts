import { expect, test } from "@playwright/test";
import { CRON_TEST_SECRET } from "./support/cron";

/** Aufräumen personenbezogener Daten nach Frist (Phase 10). */
test.describe("Aufräum-Cron", () => {
  test("verlangt den Schlüssel und meldet, was gelöscht wurde", async ({
    request,
  }) => {
    expect((await request.get("/api/cron/aufraeumen")).status()).toBe(401);
    const ok = await request.get("/api/cron/aufraeumen", {
      headers: { Authorization: `Bearer ${CRON_TEST_SECRET}` },
    });
    expect(ok.status()).toBe(200);
    expect(await ok.json()).toEqual({
      emailLogs: expect.any(Number),
      pendingSubscribers: expect.any(Number),
    });
  });
});
