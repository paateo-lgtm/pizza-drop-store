import "server-only";
import type { ReactElement } from "react";
import { Resend } from "resend";
import { db } from "@/lib/db";

export type MailResult = "sent" | "duplicate" | "skipped";

let client: Resend | null = null;

const FROM = () =>
  process.env.MAIL_FROM ?? "Pizza Drop <onboarding@resend.dev>";

/**
 * Verschickt eine Mail höchstens einmal pro `dedupeKey` (EmailLog). Ohne RESEND_API_KEY
 * (lokal) wird nur protokolliert. Schlägt der Versand fehl, wird der Eintrag wieder
 * entfernt, damit ein späterer Versuch möglich ist.
 */
export async function sendMail(mail: {
  kind: string;
  to: string;
  dedupeKey: string;
  subject: string;
  react: ReactElement;
}): Promise<MailResult> {
  const { count } = await db.emailLog.createMany({
    data: [{ kind: mail.kind, to: mail.to, dedupeKey: mail.dedupeKey }],
    skipDuplicates: true,
  });
  if (count === 0) return "duplicate";

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // Keine Adresse ins Log: nur Art und Schlüssel
    console.info(
      `[Mail nicht gesendet, RESEND_API_KEY fehlt] ${mail.dedupeKey}`,
    );
    await db.emailLog.update({
      where: { dedupeKey: mail.dedupeKey },
      data: { providerId: "nicht-gesendet" },
    });
    return "skipped";
  }

  client ??= new Resend(key);
  try {
    const { data, error } = await client.emails.send(
      { from: FROM(), to: mail.to, subject: mail.subject, react: mail.react },
      { idempotencyKey: mail.dedupeKey },
    );
    if (error) throw new Error(`${error.name}: ${error.message}`);
    await db.emailLog.update({
      where: { dedupeKey: mail.dedupeKey },
      data: { providerId: data?.id ?? null },
    });
    return "sent";
  } catch (error) {
    await db.emailLog.delete({ where: { dedupeKey: mail.dedupeKey } });
    throw error;
  }
}
