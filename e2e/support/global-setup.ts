import { pool } from "./shop-data";

/**
 * Drop-Alarm und Warteliste erscheinen erst mit vollständigem Impressum. Fehlen die
 * Betreiberangaben in der Testdatenbank, trägt das Setup Testwerte ein; vorhandene
 * vollständige Angaben bleiben unangetastet.
 */
export default async function globalSetup() {
  const { rows } = await pool.query<{ value: Record<string, string> }>(
    `SELECT value FROM "SiteContent" WHERE key = 'legal'`,
  );
  const legal = rows[0]?.value ?? {};
  const complete = ["operatorName", "street", "postalCity", "email"].every(
    (key) => typeof legal[key] === "string" && legal[key].trim() !== "",
  );
  if (!complete) {
    const value = {
      operatorName: "E2E Pizza Drop",
      street: "Teststraße 1",
      postalCity: "12345 Teststadt",
      email: "impressum@pizzadrop.test",
      phone: "",
      vatId: "",
      responsible: "",
    };
    await pool.query(
      `INSERT INTO "SiteContent" (key, value, "updatedAt") VALUES ('legal', $1, now())
       ON CONFLICT (key) DO UPDATE SET value = $1, "updatedAt" = now()`,
      [JSON.stringify(value)],
    );
  }
  await pool.end();
}
