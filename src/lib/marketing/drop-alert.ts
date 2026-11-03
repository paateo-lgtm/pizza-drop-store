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

/**
 * Version des Einwilligungstexts im Anmeldeformular (Nachweis nach DSGVO Art. 7).
 * Bei jeder inhaltlichen Änderung des Texts hochzählen.
 */
export const CONSENT_VERSION = "einwilligung-2026-11-01";

/** Kennung der Bestätigungsmails im Mail-Protokoll (für das Stundenbudget). */
export const CONFIRM_MAIL_KIND = "drop-alarm-bestaetigen";

/** 32 Byte Zufall: nicht zu erraten, auch nicht über viele Versuche. */
export const newToken = () => randomBytes(32).toString("base64url");

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/**
 * Anmeldung zum Drop-Alarm. Gibt bewusst nichts zurück: Die Antwort an die Person
 * ist immer dieselbe, egal ob die Adresse schon bekannt ist. `allowConfirm` begrenzt
 * die Bestätigungsmails insgesamt (Schutz fremder Postfächer); die Anmeldung bleibt
 * dann offen, ein späterer Versuch schickt den Link.
 */
export async function subscribe(
  rawEmail: string,
  deps: {
    sendConfirm: (mail: ConfirmMail) => Promise<unknown>;
    allowConfirm?: () => Promise<boolean>;
  },
  source = "landingpage",
): Promise<void> {
  const email = normalizeEmail(rawEmail);
  const existing = await db.subscriber.findUnique({ where: { email } });
  const action = subscribeAction(existing?.status ?? null);
  if (action === "none") return;
  const origin = `${source}|${CONSENT_VERSION}`;

  let subscriber;
  if (action === "create") {
    // Gleichzeitige Anmeldungen derselben Adresse: der zweite Versuch findet den ersten.
    subscriber = await db.subscriber.upsert({
      where: { email },
      update: {},
      create: { email, token: newToken(), source: origin },
    });
  } else if (action === "restart") {
    subscriber = await db.subscriber.update({
      where: { email },
      data: {
        status: "PENDING",
        token: newToken(),
        confirmedAt: null,
        unsubscribedAt: null,
        source: origin,
        // Neue Anmeldung: Die 30-Tage-Frist des Aufräum-Crons beginnt von vorn
        createdAt: new Date(),
      },
    });
  } else {
    subscriber = existing!;
  }
  if (subscriber.status !== "PENDING") return;
  if (deps.allowConfirm && !(await deps.allowConfirm())) {
    console.warn("Drop-Alarm: Stundenbudget für Bestätigungsmails erschöpft");
    return;
  }

  await deps.sendConfirm({
    to: subscriber.email,
    token: subscriber.token,
    dedupeKey: confirmMailKey(subscriber.id, new Date()),
  });
}

/** Bestätigungsmails der letzten Stunde, über alle Adressen. */
export function confirmMailsLastHour(now: Date): Promise<number> {
  return db.emailLog.count({
    where: {
      kind: CONFIRM_MAIL_KIND,
      createdAt: { gte: new Date(now.getTime() - 3_600_000) },
    },
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

export type AlertRun = {
  sent: number;
  /** Ohne RESEND_API_KEY nicht versendet: ein Einrichtungsfehler, kein Erfolg */
  skipped: number;
  failed: number;
  /** Noch offen für spätere Läufe (Limit, Zeitbudget, Fehler) */
  remaining: number;
};

/**
 * Verschickt den Alarm für alle Drops im Verkauf an bestätigte Abonnenten, die ihn
 * noch nicht haben. Jeder Versuch zählt zum `limit` (Resend-Limits); nach `deadline`
 * (ms seit Epoche) bricht der Lauf ab. Gescheiterte Mails versucht der nächste Lauf.
 */
export async function sendDueDropAlerts(
  now: Date,
  deps: {
    sendAlert: (mail: AlertMail) => Promise<MailResult>;
    limit: number;
    deadline?: number;
  },
): Promise<AlertRun> {
  const candidates = await db.drop.findMany({
    where: {
      status: { in: ["SCHEDULED", "ON_SALE"] },
      saleEndsAt: { gt: now },
    },
    orderBy: { saleStartsAt: "asc" },
  });
  const due = candidates.filter((drop) => isAlertDue(drop, now));

  const run: AlertRun = { sent: 0, skipped: 0, failed: 0, remaining: 0 };
  let attempts = 0;
  for (const drop of due) {
    const subscribers = await db.subscriber.findMany({
      where: { status: "CONFIRMED" },
      orderBy: { confirmedAt: "asc" },
      select: { id: true, email: true, token: true },
    });
    // Erledigt oder gerade in Arbeit; gescheiterte bzw. übersprungene zählen nicht.
    // Exakte Schlüssel statt Präfixsuche: trifft den Unique-Index auf dedupeKey.
    const done = await db.emailLog.findMany({
      where: {
        dedupeKey: { in: subscribers.map((s) => alertMailKey(drop.id, s.id)) },
        OR: [
          { providerId: null },
          { providerId: { notIn: [MAIL_FAILED, MAIL_SKIPPED] } },
        ],
      },
      select: { dedupeKey: true },
    });
    const doneKeys = new Set(done.map((d) => d.dedupeKey));
    const open = subscribers.filter(
      (s) => !doneKeys.has(alertMailKey(drop.id, s.id)),
    );

    for (const subscriber of open) {
      const outOfTime =
        deps.deadline !== undefined && Date.now() > deps.deadline;
      if (attempts >= deps.limit || outOfTime) {
        run.remaining += 1;
        continue;
      }
      // Wer sich während des Laufs abmeldet, bekommt nichts mehr.
      const current = await db.subscriber.findUnique({
        where: { id: subscriber.id },
        select: { status: true },
      });
      if (current?.status !== "CONFIRMED") continue;

      attempts += 1;
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
        if (result === "sent") run.sent += 1;
        if (result === "skipped") {
          run.skipped += 1;
          run.remaining += 1;
        }
      } catch (error) {
        // Eine kaputte Adresse darf die übrigen nicht aufhalten; der nächste Lauf versucht es erneut.
        console.error(`Drop-Alarm an ${subscriber.id} fehlgeschlagen`, error);
        run.failed += 1;
        run.remaining += 1;
      }
    }
  }
  return run;
}
