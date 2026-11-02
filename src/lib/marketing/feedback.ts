/**
 * Feedback nach Abholung gegen die Datenbank: Anfrage per Cron, Bewertung über den
 * persönlichen Link, Widerspruch (siehe docs/PLAN.md, 1.6).
 */
import "server-only";
import type { MailResult } from "@/lib/mail/send";
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

export async function sendDueFeedbackRequests(
  _now: Date,
  _deps: {
    sendRequest: (mail: FeedbackRequest) => Promise<MailResult>;
    limit: number;
    deadline?: number;
  },
): Promise<AlertRun> {
  throw new Error("noch nicht umgesetzt");
}

export async function submitFeedback(
  _input: { orderId: string; key: string; rating: number; comment: string },
  _now = new Date(),
): Promise<"saved" | "done" | "closed" | "invalid"> {
  throw new Error("noch nicht umgesetzt");
}

export async function withdrawFeedbackConsent(
  _orderId: string,
  _key: string,
): Promise<"withdrawn" | "invalid"> {
  throw new Error("noch nicht umgesetzt");
}
