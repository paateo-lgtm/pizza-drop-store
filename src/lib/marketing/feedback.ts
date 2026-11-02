/**
 * Feedback nach Abholung gegen die Datenbank: Anfrage per Cron, Bewertung über den
 * persönlichen Link, Widerspruch (siehe docs/PLAN.md, 1.6). Der Mailversand kommt als
 * Abhängigkeit herein, damit Tests ohne Resend laufen.
 */
import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { feedbackPath, verifyFeedbackKey } from "@/lib/booking/order-link";
import { db } from "@/lib/db";
import {
  FEEDBACK_ASK_UNTIL_MS,
  FEEDBACK_DELAY_MS,
  feedbackMailKey,
  feedbackState,
} from "@/lib/domain/feedback";
import { MAIL_FAILED, MAIL_SKIPPED, type MailResult } from "@/lib/mail/send";
import type { AlertRun } from "./drop-alert";

export type FeedbackRequest = {
  to: string;
  dedupeKey: string;
  orderId: string;
  orderNumber: number;
  dropTitle: string;
  /** Pfad mit Schlüssel, z. B. /feedback/<id>?k=… */
  feedbackPath: string;
};

export const MAX_COMMENT_LENGTH = 1000;

/**
 * Fragt abgeholte Bestellungen mit Einwilligung nach einer Bewertung, einmal pro
 * Bestellung (Mail-Protokoll). Jeder Versuch zählt zum `limit`; nach `deadline`
 * (ms seit Epoche) bricht der Lauf ab. Übersprungene und gescheiterte versucht der
 * nächste Lauf erneut, solange das Zeitfenster offen ist.
 */
export async function sendDueFeedbackRequests(
  now: Date,
  deps: {
    sendRequest: (mail: FeedbackRequest) => Promise<MailResult>;
    limit: number;
    deadline?: number;
  },
): Promise<AlertRun> {
  const t = now.getTime();
  const candidates = await db.order.findMany({
    where: {
      status: "PICKED_UP",
      feedbackConsent: true,
      feedback: null,
      pickedUpAt: {
        lte: new Date(t - FEEDBACK_DELAY_MS),
        gte: new Date(t - FEEDBACK_ASK_UNTIL_MS),
      },
    },
    orderBy: { pickedUpAt: "asc" },
    select: {
      id: true,
      number: true,
      customer: { select: { email: true } },
      drop: { select: { title: true } },
    },
  });
  // Erledigt oder gerade in Arbeit; gescheiterte bzw. übersprungene zählen nicht.
  const done = await db.emailLog.findMany({
    where: {
      dedupeKey: { in: candidates.map((o) => feedbackMailKey(o.id)) },
      OR: [
        { providerId: null },
        { providerId: { notIn: [MAIL_FAILED, MAIL_SKIPPED] } },
      ],
    },
    select: { dedupeKey: true },
  });
  const doneKeys = new Set(done.map((d) => d.dedupeKey));

  const run: AlertRun = { sent: 0, skipped: 0, failed: 0, remaining: 0 };
  let attempts = 0;
  for (const order of candidates) {
    const dedupeKey = feedbackMailKey(order.id);
    if (doneKeys.has(dedupeKey)) continue;
    const outOfTime = deps.deadline !== undefined && Date.now() > deps.deadline;
    if (attempts >= deps.limit || outOfTime) {
      run.remaining += 1;
      continue;
    }
    attempts += 1;
    try {
      const result = await deps.sendRequest({
        to: order.customer.email,
        dedupeKey,
        orderId: order.id,
        orderNumber: order.number,
        dropTitle: order.drop.title,
        feedbackPath: feedbackPath(order.id),
      });
      if (result === "sent") run.sent += 1;
      if (result === "skipped") {
        run.skipped += 1;
        run.remaining += 1;
      }
    } catch (error) {
      console.error(`Feedback-Anfrage zu ${order.id} fehlgeschlagen`, error);
      run.failed += 1;
      run.remaining += 1;
    }
  }
  return run;
}

/** Bewertung über den persönlichen Link: einmal pro Bestellung, bis 30 Tage nach Abholung. */
export async function submitFeedback(
  input: { orderId: string; key: string; rating: number; comment: string },
  now = new Date(),
): Promise<"saved" | "done" | "closed" | "invalid"> {
  const comment = input.comment.trim();
  if (
    !verifyFeedbackKey(input.orderId, input.key) ||
    !Number.isInteger(input.rating) ||
    input.rating < 1 ||
    input.rating > 5 ||
    comment.length > MAX_COMMENT_LENGTH
  ) {
    return "invalid";
  }
  const order = await db.order.findUnique({
    where: { id: input.orderId },
    select: {
      status: true,
      pickedUpAt: true,
      feedback: { select: { id: true } },
    },
  });
  if (!order) return "invalid";
  const state = feedbackState(
    { ...order, hasFeedback: order.feedback !== null },
    now,
  );
  if (state !== "open") return state;
  try {
    await db.feedback.create({
      data: {
        orderId: input.orderId,
        rating: input.rating,
        comment: comment || null,
      },
    });
  } catch (error) {
    // Zwei Klicks gleichzeitig: Die erste Bewertung zählt.
    const known = error instanceof Prisma.PrismaClientKnownRequestError;
    if (known && error.code === "P2002") return "done";
    throw error;
  }
  return "saved";
}

/**
 * Widerspruch gegen Feedback-Anfragen (Pflicht in jeder Werbe-Mail): gilt für alle
 * Bestellungen dieser E-Mail-Adresse, nicht nur für die eine.
 */
export async function withdrawFeedbackConsent(
  orderId: string,
  key: string,
): Promise<"withdrawn" | "invalid"> {
  if (!verifyFeedbackKey(orderId, key)) return "invalid";
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { customerId: true },
  });
  if (!order) return "invalid";
  await db.order.updateMany({
    where: { customerId: order.customerId, feedbackConsent: true },
    data: { feedbackConsent: false },
  });
  return "withdrawn";
}
