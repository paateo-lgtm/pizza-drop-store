import "server-only";
import { db } from "@/lib/db";
import { stripeGateway } from "./gateway";
import { sendOrderNotice } from "./order-mails";
import { settleCheckout } from "./settle";
import { getStripe, isStripeConfigured } from "./stripe";

export type ReturnState = "settled" | "pending" | "notPaid";

/**
 * Rückkehr von Stripe: Statt nur auf den Webhook zu warten, fragt der Server selbst nach
 * und verbucht eine bezahlte Session sofort – mit derselben, idempotenten Logik wie der
 * Webhook. Der spätere Webhook ist dann ein Duplikat.
 */
export async function reconcileReturn(orderId: string): Promise<ReturnState> {
  if (!isStripeConfigured()) return "pending";
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { status: true, stripeSessionId: true },
  });
  if (!order?.stripeSessionId || order.status !== "PENDING_PAYMENT") {
    return order?.status === "PENDING_PAYMENT" ? "notPaid" : "settled";
  }
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
