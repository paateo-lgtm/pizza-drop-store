import Stripe from "stripe";

/** Gleiches Secret für den Testserver (playwright.config.ts) und die signierten Test-Events. */
export const WEBHOOK_SECRET =
  process.env.STRIPE_WEBHOOK_SECRET || "whsec_e2e_nur_fuer_tests";

const signer = new Stripe("sk_test_nur_signatur").webhooks;

/** Schickt ein signiertes „checkout.session.completed“ wie Stripe an den Testserver. */
export async function sendPaidEvent(
  baseURL: string,
  options: { eventId: string; orderId: string; paymentIntentId: string },
) {
  const payload = JSON.stringify({
    id: options.eventId,
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: `cs_${options.eventId}`,
        object: "checkout.session",
        payment_status: "paid",
        payment_intent: options.paymentIntentId,
        client_reference_id: options.orderId,
        metadata: { orderId: options.orderId },
      },
    },
  });
  return fetch(`${baseURL}/api/stripe/webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": signer.generateTestHeaderString({
        payload,
        secret: WEBHOOK_SECRET,
      }),
    },
    body: payload,
  });
}
