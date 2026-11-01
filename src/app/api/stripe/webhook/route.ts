import { stripeGateway } from "@/lib/payment/gateway";
import { sendOrderNotice } from "@/lib/payment/order-mails";
import { settleCheckout } from "@/lib/payment/settle";
import { readCheckoutEvent } from "@/lib/payment/webhook";

/**
 * Stripe meldet hier Zahlungen. Antwortet die Route nicht mit 2xx, stellt Stripe das
 * Event erneut zu; die Verarbeitung ist idempotent (siehe settleCheckout).
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error(
      "STRIPE_WEBHOOK_SECRET fehlt – Webhook kann nicht geprüft werden",
    );
    return new Response("Nicht eingerichtet", { status: 500 });
  }

  const event = readCheckoutEvent(
    await request.text(),
    request.headers.get("stripe-signature"),
    secret,
  );
  if (event.kind === "invalid") {
    return new Response("Ungültige Signatur", { status: 400 });
  }
  if (event.kind === "ignored") return Response.json({ received: true });

  const result = await settleCheckout(event.input, {
    gateway: stripeGateway,
    notify: sendOrderNotice,
  });
  if (result === "unknown") {
    console.warn(`Zahlung zu unbekannter Bestellung ${event.input.orderId}`);
  }
  return Response.json({ received: true, result });
}
