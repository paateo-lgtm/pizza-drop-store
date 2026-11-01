/**
 * Testdaten direkt in der Datenbank (DATABASE_URL, lokal der Neon-Zweig "dev"):
 * ein Drop im Verkauf. Jeder Test legt seinen eigenen an und räumt ihn wieder ab.
 *
 * Bewusst mit `pg` statt Prisma: Playwright lädt Tests als CommonJS, der generierte
 * Prisma-Client ist ein ES-Modul.
 */
import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  // Mehrere Testdateien teilen sich den Pool im Worker; kein pool.end() nötig.
  allowExitOnIdle: true,
});

const HOUR = 3_600_000;
const SLOT = 360_000;

/**
 * Eine gemeinsame Testpizza, die bleibt: Würde jeder Test seine eigene löschen, verlöre ein
 * parallel laufendes Admin-Formular (das alle aktiven Pizzen vorauswählt) seine Auswahl.
 */
async function sharedPizzaId(client: PoolClient) {
  await client.query(
    `INSERT INTO "Pizza" (id, slug, name, description, "priceCents", allergens, tags, "sortOrder", "updatedAt")
     VALUES ($1, 'e2e-margherita', 'Margherita', 'Tomate, Fior di Latte, Basilikum.', 1050,
       '{Gluten,Milch}', '{vegetarisch}', 999, now())
     ON CONFLICT (slug) DO NOTHING`,
    [randomUUID()],
  );
  const { rows } = await client.query<{ id: string }>(
    `SELECT id FROM "Pizza" WHERE slug = 'e2e-margherita'`,
  );
  return rows[0].id;
}

export async function createBookableDrop(key: string, slotCount = 12) {
  const tag = `e2e-${key}-${randomUUID().slice(0, 8)}`;
  const dropId = randomUUID();
  // Backbeginn morgen zur vollen Stunde, damit alle Slots buchbar sind
  const bakeStartsAt = new Date(
    Math.ceil((Date.now() + 24 * HOUR) / HOUR) * HOUR,
  );
  const bakeEndsAt = new Date(bakeStartsAt.getTime() + slotCount * SLOT);

  const client = await pool.connect();
  try {
    const pizzaId = await sharedPizzaId(client);
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO "Drop" (id, slug, title, status, "saleStartsAt", "saleEndsAt", "bakeStartsAt",
         "bakeEndsAt", "slotSeconds", "maxPizzasPerOrder", location, "updatedAt")
       VALUES ($1, $2, $3, 'ON_SALE', $4, $5, $6, $7, 360, 4, 'Hinterhof', now())`,
      [
        dropId,
        tag,
        `Testdrop ${key}`,
        new Date(Date.now() - HOUR),
        new Date(bakeStartsAt.getTime() - HOUR),
        bakeStartsAt,
        bakeEndsAt,
      ],
    );
    await client.query(
      `INSERT INTO "DropPizza" ("dropId", "pizzaId") VALUES ($1, $2)`,
      [dropId, pizzaId],
    );
    for (let i = 0; i < slotCount; i++) {
      await client.query(
        `INSERT INTO "Slot" (id, "dropId", seq, "startsAt", "endsAt") VALUES ($1, $2, $3, $4, $5)`,
        [
          randomUUID(),
          dropId,
          i + 1,
          new Date(bakeStartsAt.getTime() + i * SLOT),
          new Date(bakeStartsAt.getTime() + (i + 1) * SLOT),
        ],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return {
    slug: tag,
    tag,
    dropId,
    bakeStartsAt,
    emailPrefix: tag,
    async orders() {
      const { rows } = await pool.query<{
        status: string;
        totalCents: number;
        seqs: number[];
      }>(
        `SELECT o.status, o."totalCents",
           array_agg(s.seq ORDER BY s.seq) FILTER (WHERE s.seq IS NOT NULL) AS seqs
         FROM "Order" o LEFT JOIN "Slot" s ON s."orderId" = o.id
         WHERE o."dropId" = $1 GROUP BY o.id`,
        [dropId],
      );
      return rows;
    },
    async cleanup() {
      // Mails und Webhook-Events dieser Bestellungen (Schlüssel enden auf die Bestell-ID)
      await pool.query(
        `DELETE FROM "EmailLog" WHERE split_part("dedupeKey", ':', 2) IN (SELECT id FROM "Order" WHERE "dropId" = $1)`,
        [dropId],
      );
      await pool.query(`DELETE FROM "ProcessedWebhookEvent" WHERE id LIKE $1`, [
        `evt_${tag}%`,
      ]);
      const { rows } = await pool.query<{ customerId: string }>(
        `DELETE FROM "Order" WHERE "dropId" = $1 RETURNING "customerId"`,
        [dropId],
      );
      await pool.query(`DELETE FROM "Drop" WHERE id = $1`, [dropId]);
      await pool.query(
        `DELETE FROM "Customer" WHERE id = ANY($1) AND email LIKE $2`,
        [rows.map((r) => r.customerId), `${tag}%`],
      );
    },
  };
}

/** Uhrzeit wie auf der Seite (Europe/Berlin, HH:MM) */
export const berlinTime = (date: Date) =>
  new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  }).format(date);
