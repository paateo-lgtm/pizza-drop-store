/**
 * Drop-Alarm gegen die Datenbank: Anmeldung mit Double-Opt-in, Bestätigung, Abmeldung
 * und der Versand zum Verkaufsstart (siehe docs/PLAN.md, 1.6). Der Mailversand kommt
 * als Abhängigkeit herein, damit Tests ohne Resend laufen.
 */
import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import {
  alertMailKey,
  canConfirm,
  confirmMailKey,
  isAlertDue,
  subscribeAction,
} from "@/lib/domain/subscription";
import { MAIL_FAILED, MAIL_SKIPPED, type MailResult } from "@/lib/mail/send";

export type ConfirmMail = { to: string; token: string; dedupeKey: string };

export type AlertMail = {
  to: string;
  dedupeKey: string;
  dropId: string;
  dropSlug: string;
  dropTitle: string;
  bakeStartsAt: Date;
  bakeEndsAt: Date;
  saleEndsAt: Date;
  unsubscribeToken: string;
};

/** 32 Byte Zufall: nicht zu erraten, auch nicht über viele Versuche. */
const newToken = () => randomBytes(32).toString("base64url");

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/**
 * Anmeldung zum Drop-Alarm. Gibt bewusst nichts zurück: Die Antwort an die Person
 * ist immer dieselbe, egal ob die Adresse schon bekannt ist.
 */
export async function subscribe(
  rawEmail: string,
  deps: { sendConfirm: (mail: ConfirmMail) => Promise<unknown> },
  source = "landingpage",
): Promise<void> {
  const email = normalizeEmail(rawEmail);
  const existing = await db.subscriber.findUnique({ where: { email } });
  const action = subscribeAction(existing?.status ?? null);
  if (action === "none") return;

  let subscriber;
  if (action === "create") {
    // Gleichzeitige Anmeldungen derselben Adresse: der zweite Versuch findet den ersten.
    subscriber = await db.subscriber.upsert({
      where: { email },
      update: {},
      create: { email, token: newToken(), source },
    });
  } else if (action === "restart") {
    subscriber = await db.subscriber.update({
      where: { email },
      data: {
        status: "PENDING",
        token: newToken(),
        confirmedAt: null,
        unsubscribedAt: null,
        source,
      },
    });
  } else {
    subscriber = existing!;
  }
  if (subscriber.status !== "PENDING") return;

  await deps.sendConfirm({
    to: subscriber.email,
    token: subscriber.token,
    dedupeKey: confirmMailKey(subscriber.id, new Date()),
  });
}

export async function confirmSubscription(
  token: string,
): Promise<"confirmed" | "already" | "invalid"> {
  const subscriber = await db.subscriber.findUnique({ where: { token } });
  if (!subscriber) return "invalid";
  if (!canConfirm(subscriber.status)) {
    return subscriber.status === "CONFIRMED" ? "already" : "invalid";
  }
  // Nur aus PENDING heraus, auch wenn zwei Klicks gleichzeitig ankommen.
  const { count } = await db.subscriber.updateMany({
    where: { id: subscriber.id, status: "PENDING" },
    data: { status: "CONFIRMED", confirmedAt: new Date() },
  });
  return count > 0 ? "confirmed" : "already";
}

/** Abmelden ist idempotent: ein zweiter Klick zeigt dieselbe Bestätigung. */
export async function unsubscribe(
  token: string,
): Promise<"unsubscribed" | "invalid"> {
  const subscriber = await db.subscriber.findUnique({ where: { token } });
  if (!subscriber) return "invalid";
  if (subscriber.status !== "UNSUBSCRIBED") {
    await db.subscriber.update({
      where: { id: subscriber.id },
      data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() },
    });
  }
  return "unsubscribed";
}

/**
 * Verschickt den Alarm für alle Drops im Verkauf an bestätigte Abonnenten, die ihn
 * noch nicht haben – höchstens `limit` Mails pro Lauf (Resend-Limits, Laufzeit).
 * Gescheiterte Mails versucht der nächste Lauf erneut.
 */
export async function sendDueDropAlerts(
  now: Date,
  deps: {
    sendAlert: (mail: AlertMail) => Promise<MailResult>;
    limit: number;
  },
): Promise<{ sent: number; remaining: number }> {
  const candidates = await db.drop.findMany({
    where: {
      status: { in: ["SCHEDULED", "ON_SALE"] },
      saleEndsAt: { gt: now },
    },
    orderBy: { saleStartsAt: "asc" },
  });
  const due = candidates.filter((drop) => isAlertDue(drop, now));

  let sent = 0;
  let remaining = 0;
  for (const drop of due) {
    const prefix = alertMailKey(drop.id, "");
    // Erledigt oder gerade in Arbeit; gescheiterte bzw. übersprungene zählen nicht.
    const done = await db.emailLog.findMany({
      where: {
        dedupeKey: { startsWith: prefix },
        OR: [
          { providerId: null },
          { providerId: { notIn: [MAIL_FAILED, MAIL_SKIPPED] } },
        ],
      },
      select: { dedupeKey: true },
    });
    const doneIds = new Set(done.map((d) => d.dedupeKey.slice(prefix.length)));
    const subscribers = await db.subscriber.findMany({
      where: { status: "CONFIRMED" },
      orderBy: { confirmedAt: "asc" },
      select: { id: true, email: true, token: true },
    });
    const open = subscribers.filter((s) => !doneIds.has(s.id));

    for (const subscriber of open) {
      if (sent >= deps.limit) {
        remaining += 1;
        continue;
      }
      try {
        const result = await deps.sendAlert({
          to: subscriber.email,
          dedupeKey: alertMailKey(drop.id, subscriber.id),
          dropId: drop.id,
          dropSlug: drop.slug,
          dropTitle: drop.title,
          bakeStartsAt: drop.bakeStartsAt,
          bakeEndsAt: drop.bakeEndsAt,
          saleEndsAt: drop.saleEndsAt,
          unsubscribeToken: subscriber.token,
        });
        if (result === "sent") sent += 1;
      } catch (error) {
        // Eine kaputte Adresse darf die übrigen nicht aufhalten; der nächste Lauf versucht es erneut.
        console.error(`Drop-Alarm an ${subscriber.id} fehlgeschlagen`, error);
        remaining += 1;
      }
    }
  }
  return { sent, remaining };
}
