import "server-only";

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
  void now;
  throw new Error("not implemented");
}
