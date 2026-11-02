"use server";

import { redirect } from "next/navigation";
import { orderPath, verifyOrderKey } from "@/lib/booking/order-link";
import { db } from "@/lib/db";
import { canStartPayment } from "@/lib/domain/payment";
import { appUrl } from "@/lib/payment/order-mails";
import { getStripe, isStripeConfigured } from "@/lib/payment/stripe";

export type PayState = { message: string } | undefined;

const FAILED =
  "Die Zahlung konnte gerade nicht gestartet werden. Bitte versuch es gleich noch einmal.";

// Stripe verlangt mindestens 30 Minuten Laufzeit. Zahlungen nach Ablauf der Reservierung
// fängt der Webhook ab (annehmen, solange die Slots frei sind, sonst erstatten).
const SESSION_SECONDS = 31 * 60;

/** Leitet zu Stripe Checkout weiter; eine noch offene Session wird wiederverwendet. */
export async function startPayment(
  orderId: string,
  key: string,
): Promise<PayState> {
  if (!verifyOrderKey(orderId, key)) {
    return { message: "Dieser Link ist ungültig." };
  }
  if (!isStripeConfigured()) {
    return { message: "Die Online-Zahlung ist noch nicht eingerichtet." };
  }
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: true, customer: { select: { email: true } } },
  });
  if (!order || !canStartPayment(order.status, order.expiresAt, new Date())) {
    return {
      message:
        "Die Reservierung ist abgelaufen oder schon bezahlt. Bitte lade die Seite neu.",
    };
  }

  const back = `${appUrl()}${orderPath(order.id)}`;
  const sum = order.items.reduce(
    (total, item) => total + item.quantity * item.unitPriceCents,
    0,
  );
  if (sum - order.discountCents !== order.totalCents) {
    console.error(
      `Positionen von Bestellung ${order.number} ergeben nicht die Summe`,
    );
    return { message: FAILED };
  }

  const stripe = getStripe();
  let url: string;
  try {
    const existing = order.stripeSessionId
      ? await stripe.checkout.sessions
          .retrieve(order.stripeSessionId)
          // z. B. Session aus einem anderen Stripe-Konto: dann einfach neu anlegen
          .catch(() => null)
      : null;
    if (existing?.status === "complete") {
      // Bezahlt, aber der Webhook ist noch nicht da: kein zweites Zahlfenster öffnen
      url = `${back}&bezahlt=1`;
    } else if (existing?.status === "open" && existing.url) {
      url = existing.url;
    } else {
      // Rabatt als einmaliger Stripe-Coupon über genau den Betrag der Bestellung: So zahlt
      // der Kunde exakt totalCents, und der Webhook erkennt den Betrag wieder.
      const discount =
        order.discountCents > 0
          ? await stripe.coupons.create(
              {
                amount_off: order.discountCents,
                currency: "eur",
                duration: "once",
                max_redemptions: 1,
                // Aus festen Bestelldaten: Gleicher Idempotenz-Schlüssel braucht gleiche Parameter.
                name: `Gutschein · Bestellung ${order.number}`,
              },
              { idempotencyKey: `coupon:${order.id}` },
            )
          : null;
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        locale: "de",
        customer_email: order.customer.email,
        client_reference_id: order.id,
        metadata: { orderId: order.id },
        payment_intent_data: { metadata: { orderId: order.id } },
        expires_at: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
        line_items: order.items.map((item) => ({
          quantity: item.quantity,
          price_data: {
            currency: "eur",
            unit_amount: item.unitPriceCents,
            product_data: { name: item.nameSnapshot },
          },
        })),
        discounts: discount ? [{ coupon: discount.id }] : undefined,
        success_url: `${back}&bezahlt=1`,
        cancel_url: back,
      });
      if (!session.url) throw new Error("Stripe-Session ohne URL");
      await db.order.update({
        where: { id: order.id },
        data: { stripeSessionId: session.id },
      });
      url = session.url;
    }
  } catch (error) {
    console.error(
      `Zahlung für Bestellung ${order.number} nicht gestartet`,
      error,
    );
    return { message: FAILED };
  }
  redirect(url);
}
