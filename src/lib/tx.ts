/**
 * Gemeinsame Regeln für Datenbank-Transaktionen (siehe docs/PLAN.md, 3.2).
 * Hier und nur hier: die Drop-Sperre und die Frage, ob ein Fehler nur „gerade belegt“ ist.
 */
import { Prisma } from "@/generated/prisma/client";

/**
 * Alle Änderungen an einem Drop laufen nacheinander: erst die Drop-Zeile sperren, dann
 * den aktuellen Stand lesen und prüfen. Reservierung, Zahlung, Storno, Küche und Admin
 * nutzen diese eine Funktion, damit die Regel nicht an kopiertem SQL hängt.
 */
export async function lockDrop(tx: Prisma.TransactionClient, dropId: string) {
  await tx.$queryRaw`SELECT id FROM "Drop" WHERE id = ${dropId} FOR UPDATE`;
}

/**
 * Einlösungen eines Gutscheins laufen nacheinander, auch über verschiedene Drops: Die
 * Grenzen (gesamt, pro Kunde) werden erst nach dieser Sperre gezählt. Immer nach
 * lockDrop() aufrufen, damit die Reihenfolge der Sperren überall gleich ist.
 */
export async function lockCoupon(
  tx: Prisma.TransactionClient,
  couponId: string,
) {
  await tx.$queryRaw`SELECT id FROM "Coupon" WHERE id = ${couponId} FOR UPDATE`;
}

/**
 * Kurzzeitig belegt – erneut versuchen hilft: keine Verbindung frei (P2024),
 * Transaktion zu lang (P2028), Schreibkonflikt (P2034). Alles andere ist ein echter Fehler.
 */
const BUSY_CODES = new Set(["P2024", "P2028", "P2034"]);

export function isBusyError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    BUSY_CODES.has(error.code)
  );
}
