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

export function isFeedbackDue(_order: FeedbackOrder, _now: Date): boolean {
  throw new Error("noch nicht umgesetzt");
}

export function feedbackState(
  _order: Omit<FeedbackOrder, "feedbackConsent">,
  _now: Date,
): "open" | "done" | "closed" {
  throw new Error("noch nicht umgesetzt");
}

export function feedbackMailKey(_orderId: string): string {
  throw new Error("noch nicht umgesetzt");
}
