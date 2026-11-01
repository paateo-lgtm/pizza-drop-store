import "server-only";
import type { ReactElement } from "react";
import { Resend } from "resend";
import { db } from "@/lib/db";

export type MailResult = "sent" | "duplicate" | "skipped";

/** Markierungen in EmailLog.providerId: diese Mails dürfen erneut versucht werden. */
export const MAIL_FAILED = "fehlgeschlagen";
export const MAIL_SKIPPED = "nicht-gesendet";
/** Ein Versand ohne Ergebnis (Prozess abgebrochen) gilt danach als wiederholbar. */
const STALE_CLAIM_MS = 10 * 60_000;

let client: Resend | null = null;

const FROM = () =>
  process.env.MAIL_FROM ?? "Pizza Drop <onboarding@resend.dev>";

/**
 * Verschickt eine Mail höchstens einmal pro `dedupeKey` (EmailLog). Gescheiterte oder
 * mangels RESEND_API_KEY übersprungene Mails bleiben markiert und können erneut
 * versucht werden (Admin: „Mail erneut senden“).
 */
export async function sendMail(mail: {
  kind: string;
  to: string;
  dedupeKey: string;
  subject: string;
  react: ReactElement;
}): Promise<MailResult> {
  if (!(await claim(mail))) return "duplicate";

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // Keine Adresse ins Log: nur der Schlüssel. In Produktion ist das ein Fehler.
    const log =
      process.env.NODE_ENV === "production" ? console.error : console.info;
    log(`[Mail nicht gesendet, RESEND_API_KEY fehlt] ${mail.dedupeKey}`);
    await mark(mail.dedupeKey, MAIL_SKIPPED);
    return "skipped";
  }

  client ??= new Resend(key);
  let providerId: string | null;
  try {
    const { data, error } = await client.emails.send(
      { from: FROM(), to: mail.to, subject: mail.subject, react: mail.react },
      { idempotencyKey: mail.dedupeKey },
    );
    if (error) throw new Error(`${error.name}: ${error.message}`);
    providerId = data?.id ?? null;
  } catch (error) {
    await mark(mail.dedupeKey, MAIL_FAILED);
    throw error;
  }
  // Versendet ist versendet: Ein Fehler beim Vermerken darf keinen zweiten Versand auslösen.
  await mark(mail.dedupeKey, providerId ?? "gesendet");
  return "sent";
}

/** Eintrag anlegen oder einen wiederholbaren übernehmen; false = schon versendet bzw. läuft. */
async function claim(mail: { kind: string; to: string; dedupeKey: string }) {
  const { count } = await db.emailLog.createMany({
    data: [{ kind: mail.kind, to: mail.to, dedupeKey: mail.dedupeKey }],
    skipDuplicates: true,
  });
  if (count > 0) return true;
  const retry = await db.emailLog.updateMany({
    where: {
      dedupeKey: mail.dedupeKey,
      OR: [
        { providerId: { in: [MAIL_FAILED, MAIL_SKIPPED] } },
        {
          providerId: null,
          createdAt: { lt: new Date(Date.now() - STALE_CLAIM_MS) },
        },
      ],
    },
    data: { providerId: null, createdAt: new Date(), to: mail.to },
  });
  return retry.count > 0;
}

async function mark(dedupeKey: string, providerId: string) {
  try {
    await db.emailLog.update({ where: { dedupeKey }, data: { providerId } });
  } catch (error) {
    console.error(
      `EmailLog ${dedupeKey} konnte nicht aktualisiert werden`,
      error,
    );
  }
}
