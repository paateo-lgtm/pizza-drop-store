import Stripe from "stripe";
import type { SettleInput } from "./settle";

// Nur für die Signaturprüfung; ein Netzwerkzugriff findet dabei nicht statt.
const verifier = new Stripe("sk_webhook_signature_only").webhooks;

export type CheckoutEvent =
  | { kind: "paid"; input: SettleInput }
  | { kind: "ignored" }
  | { kind: "invalid" };

const PAID_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

/**
 * Prüft die Stripe-Signatur und liest bezahlte Checkout-Sessions. Bei verzögerten
 * Zahlarten meldet `completed` noch „unpaid“; bezahlt ist erst `async_payment_succeeded`.
 */
export function readCheckoutEvent(
  payload: string,
  signature: string | null,
  secret: string,
): CheckoutEvent {
  if (!signature) return { kind: "invalid" };
  let event: Stripe.Event;
  try {
    event = verifier.constructEvent(payload, signature, secret);
  } catch {
    return { kind: "invalid" };
  }
  if (!PAID_EVENTS.has(event.type)) return { kind: "ignored" };

  const session = event.data.object as Stripe.Checkout.Session;
  const orderId = session.metadata?.orderId ?? session.client_reference_id;
  if (!orderId || session.payment_status !== "paid") return { kind: "ignored" };

  const intent = session.payment_intent;
  return {
    kind: "paid",
    input: {
      eventId: event.id,
      orderId,
      sessionId: session.id,
      paymentIntentId:
        typeof intent === "string" ? intent : (intent?.id ?? null),
      amountTotal: session.amount_total ?? null,
      currency: session.currency ?? null,
    },
  };
}
