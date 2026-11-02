/**
 * Feedback nach Abholung: Wann wird gefragt, wann darf bewertet werden?
 * Reine Funktionen ohne Framework- oder Datenbankbezug (siehe docs/PLAN.md, 1.6).
 */
import type { OrderStatus } from "./drops";

export type FeedbackOrder = {
  status: OrderStatus;
  feedbackConsent: boolean;
  pickedUpAt: Date | null;
  hasFeedback: boolean;
};

const HOUR = 3_600_000;
/** Erst fragen, wenn die Pizza gegessen ist. */
export const FEEDBACK_DELAY_MS = 3 * HOUR;
/** Danach nicht mehr fragen – auch nicht für alte Bestellungen beim Start der Funktion. */
export const FEEDBACK_ASK_UNTIL_MS = 72 * HOUR;
/** So lange nimmt der Link eine Bewertung an. */
export const FEEDBACK_OPEN_MS = 30 * 24 * HOUR;

const sincePickup = (order: Pick<FeedbackOrder, "pickedUpAt">, now: Date) =>
  order.pickedUpAt ? now.getTime() - order.pickedUpAt.getTime() : null;

/**
 * Anfrage fällig? Nur mit Einwilligung aus dem Checkout: Feedback-Anfragen gelten nach
 * BGH-Rechtsprechung als Werbung.
 */
export function isFeedbackDue(order: FeedbackOrder, now: Date): boolean {
  const age = sincePickup(order, now);
  return (
    order.status === "PICKED_UP" &&
    order.feedbackConsent &&
    !order.hasFeedback &&
    age !== null &&
    age >= FEEDBACK_DELAY_MS &&
    age <= FEEDBACK_ASK_UNTIL_MS
  );
}

export function feedbackState(
  order: Omit<FeedbackOrder, "feedbackConsent">,
  now: Date,
): "open" | "done" | "closed" {
  if (order.hasFeedback) return "done";
  const age = sincePickup(order, now);
  if (order.status !== "PICKED_UP" || age === null || age > FEEDBACK_OPEN_MS) {
    return "closed";
  }
  return "open";
}

/** Pro Bestellung höchstens eine Anfrage. */
export function feedbackMailKey(orderId: string): string {
  return `feedback:${orderId}`;
}
