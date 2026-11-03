import "server-only";
import { db } from "@/lib/db";

const DAY = 86_400_000;

/** Versandprotokoll: Doppelversand-Schutz und Nachweis brauchen es danach nicht mehr. */
export const EMAIL_LOG_DAYS = 90;
/** Nie bestätigte Drop-Alarm-Anmeldungen (Double-Opt-in) */
export const PENDING_SUBSCRIBER_DAYS = 30;

export type CleanupRun = { emailLogs: number; pendingSubscribers: number };

/**
 * Löscht personenbezogene Daten nach Ablauf der Fristen aus der Datenschutzerklärung.
 * Bestätigte und abgemeldete Abonnenten bleiben: Die Abmeldung ist der Nachweis, dass wir
 * den Widerruf beachten. Wartelisten-Einträge räumt der Warteliste-Cron selbst ab.
 */
export async function cleanupPersonalData(now: Date): Promise<CleanupRun> {
  const before = (days: number) => new Date(now.getTime() - days * DAY);
  const [emailLogs, pendingSubscribers] = await Promise.all([
    db.emailLog.deleteMany({
      where: { createdAt: { lt: before(EMAIL_LOG_DAYS) } },
    }),
    db.subscriber.deleteMany({
      where: {
        status: "PENDING",
        createdAt: { lt: before(PENDING_SUBSCRIBER_DAYS) },
      },
    }),
  ]);
  return {
    emailLogs: emailLogs.count,
    pendingSubscribers: pendingSubscribers.count,
  };
}
