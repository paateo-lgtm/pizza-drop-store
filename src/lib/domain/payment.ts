/**
 * Zahlung und Storno: Entscheidungen für Webhook, Kitchen-Tickets und Erstattung.
 * Reine Funktionen ohne Framework- oder Datenbankbezug (siehe docs/PLAN.md, 3.2).
 */
import { SOLD_ORDER_STATUSES } from "./booking";
import type { OrderStatus } from "./drops";

export type CheckoutDecision = "accept" | "duplicate" | "refund";

/**
 * Was passiert, wenn Stripe eine Zahlung meldet? Angenommen wird nur, solange die
 * Bestellung alle ihre Slots noch hält – auch nach Ablauf der Reservierung, wenn
 * niemand die Slots übernommen hat. Sonst wird erstattet.
 */
export function decideCheckout(order: {
  status: OrderStatus;
  heldSlots: number;
  quantity: number;
}): CheckoutDecision {
  if (SOLD_ORDER_STATUSES.includes(order.status)) return "duplicate";
  if (order.status === "CANCELLED" || order.status === "REFUNDED") {
    return "refund";
  }
  return order.heldSlots === order.quantity ? "accept" : "refund";
}

export type TicketPlan = { slotId: string; seq: number; pizzaId: string };

/** Eine Pizza pro Slot: Positionen der Reihe nach auf die Slots in seq-Reihenfolge. */
export function assignTickets(
  slots: readonly { id: string; seq: number }[],
  items: readonly { pizzaId: string; quantity: number }[],
): TicketPlan[] {
  const pizzas = items.flatMap((item) =>
    Array.from({ length: item.quantity }, () => item.pizzaId),
  );
  if (pizzas.length !== slots.length) {
    throw new Error(
      `${pizzas.length} Pizzen passen nicht auf ${slots.length} Slots`,
    );
  }
  return [...slots]
    .sort((a, b) => a.seq - b.seq)
    .map((slot, i) => ({ slotId: slot.id, seq: slot.seq, pizzaId: pizzas[i] }));
}

/** Storno durch den Admin: offene Zahlungen verfallen, bezahlte werden erstattet. */
export function cancellationFor(
  status: OrderStatus,
): { status: "CANCELLED" | "REFUNDED"; refund: boolean } | null {
  if (status === "PENDING_PAYMENT")
    return { status: "CANCELLED", refund: false };
  if (status === "PAID" || status === "IN_PROGRESS" || status === "READY") {
    return { status: "REFUNDED", refund: true };
  }
  return null;
}

export function canStartPayment(
  status: OrderStatus,
  expiresAt: Date,
  now: Date,
): boolean {
  return status === "PENDING_PAYMENT" && expiresAt.getTime() > now.getTime();
}
