import "server-only";
import { stripeGateway } from "./gateway";
import { sendOrderNotice } from "./order-mails";
import { settleCheckout } from "./settle";
import { getStripe, isStripeConfigured } from "./stripe";

export type ReturnState = "settled" | "pending" | "notPaid";

/**
 * Rückkehr von Stripe: Statt nur auf den Webhook zu warten, fragt der Server selbst nach
 * und verbucht eine bezahlte Session sofort – mit derselben, idempotenten Logik wie der
 * Webhook. Der spätere Webhook ist dann ein Duplikat.
 *
 * Bekommt die schon geladene Bestellung, damit die Seite sie nicht doppelt liest.
 */
export async function reconcileReturn(order: {
  id: string;
  status: string;
  stripeSessionId: string | null;
}): Promise<ReturnState> {
  if (order.status !== "PENDING_PAYMENT") return "settled";
  if (!isStripeConfigured()) return "pending";
  if (!order.stripeSessionId) return "notPaid";
  const orderId = order.id;
  try {
    const session = await getStripe().checkout.sessions.retrieve(
      order.stripeSessionId,
    );
    if (session.payment_status !== "paid") {
      // Verzögerte Zahlart: bestätigt erst der Webhook
      return session.status === "complete" ? "pending" : "notPaid";
    }
    const intent = session.payment_intent;
    await settleCheckout(
      {
        eventId: `return:${session.id}`,
        orderId,
        sessionId: session.id,
        paymentIntentId:
          typeof intent === "string" ? intent : (intent?.id ?? null),
        amountTotal: session.amount_total,
        currency: session.currency,
      },
      { gateway: stripeGateway, notify: sendOrderNotice },
    );
    return "settled";
  } catch (error) {
    // Stripe nicht erreichbar o. Ä.: Der Webhook kommt trotzdem; die Seite fragt weiter.
    console.error(`Abgleich der Zahlung zu ${orderId} fehlgeschlagen`, error);
    return "pending";
  }
}
