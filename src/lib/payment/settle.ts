import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { couponLimitExceeded } from "@/lib/booking/coupon";
import { db } from "@/lib/db";
import { assignTickets, decideCheckout } from "@/lib/domain/payment";
import { lockDrop } from "@/lib/tx";
import type { PaymentGateway } from "./gateway";
import { notifySafely, type Notify } from "./notify";

export type SettleInput = {
  /** Stripe-Event-ID: dasselbe Event wird nur einmal verarbeitet */
  eventId: string;
  orderId: string;
  sessionId: string;
  paymentIntentId: string | null;
  /** Tatsächlich gezahlter Betrag laut Stripe (Cent) und Währung */
  amountTotal?: number | null;
  currency?: string | null;
};

export type SettleResult =
  | "accepted"
  | "refunded"
  | "duplicate"
  /** Bestellung war schon bezahlt; eine zweite Zahlung (z. B. zweites Zahlfenster) wird erstattet */
  | "duplicatePaymentRefunded"
  | "unknown";

// Eine Erstattung läuft innerhalb der Transaktion: Scheitert sie, rollt alles zurück –
// auch der Eintrag des Events – und Stripe stellt das Event erneut zu.
const TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 };

/**
 * Zahlungseingang aus dem Stripe-Webhook (docs/PLAN.md, 3.2, Schritte 5 und 7).
 * Unter derselben Drop-Sperre wie die Reservierung: Angenommen wird nur, wenn die
 * Bestellung ihre Slots noch hält; sonst wird sofort erstattet.
 */
export async function settleCheckout(
  input: SettleInput,
  deps: { gateway: PaymentGateway; notify: Notify },
): Promise<SettleResult> {
  const result = await db.$transaction(
    (tx) => settleInTransaction(tx, input, deps.gateway),
    TX_OPTIONS,
  );
  if (result === "accepted" || result === "refunded") {
    await notifySafely(deps.notify, {
      kind: result === "accepted" ? "confirmed" : "refunded",
      orderId: input.orderId,
    });
  }
  return result;
}

async function settleInTransaction(
  tx: Prisma.TransactionClient,
  input: SettleInput,
  gateway: PaymentGateway,
): Promise<SettleResult> {
  // ON CONFLICT DO NOTHING: Parallele Zustellungen warten hier, bis die erste fertig ist.
  const { count } = await tx.processedWebhookEvent.createMany({
    data: [{ id: input.eventId, type: "checkout.session.completed" }],
    skipDuplicates: true,
  });
  if (count === 0) return "duplicate";

  const found = await tx.order.findUnique({
    where: { id: input.orderId },
    select: { dropId: true },
  });
  if (!found) return "unknown";
  await lockDrop(tx, found.dropId);

  const order = await tx.order.findUniqueOrThrow({
    where: { id: input.orderId },
    include: {
      items: { orderBy: { id: "asc" } },
      slots: { select: { id: true, seq: true } },
    },
  });
  const quantity = order.items.reduce((sum, i) => sum + i.quantity, 0);
  // Erstattet wird immer, was wirklich gezahlt wurde.
  const paidCents = input.amountTotal ?? order.totalCents;
  const amountMismatch =
    paidCents !== order.totalCents ||
    (input.currency != null && input.currency !== "eur");
  const decision = decideCheckout({
    status: order.status,
    heldSlots: order.slots.length,
    quantity,
  });
  if (decision === "duplicate") {
    const second =
      input.paymentIntentId &&
      order.stripePaymentIntentId &&
      input.paymentIntentId !== order.stripePaymentIntentId;
    if (!second) return "duplicate";
    console.warn(
      `Zweite Zahlung zu Bestellung ${order.number} – wird erstattet`,
    );
    const refund = await gateway.refund(
      input.paymentIntentId!,
      paidCents,
      `dup:${input.paymentIntentId}`,
    );
    await tx.refund.upsert({
      where: { stripeRefundId: refund.id },
      update: {},
      create: {
        orderId: order.id,
        stripeRefundId: refund.id,
        amountCents: paidCents,
        reason: "Doppelte Zahlung",
      },
    });
    return "duplicatePaymentRefunded";
  }

  const now = new Date();
  if (decision === "accept" && amountMismatch) {
    console.error(
      `Betrag passt nicht zu Bestellung ${order.number}: ${paidCents} ${input.currency} statt ${order.totalCents} eur – wird erstattet`,
    );
  }
  // Nach Ablauf der Reservierung war die Einlösung frei; ist sie inzwischen vergeben, erstatten.
  const couponTaken =
    decision === "accept" &&
    !amountMismatch &&
    (await couponLimitExceeded(tx, order, now));
  if (couponTaken) {
    console.warn(
      `Gutschein von Bestellung ${order.number} inzwischen vergeben – wird erstattet`,
    );
  }
  if (decision === "accept" && !amountMismatch && !couponTaken) {
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        paidAt: now,
        stripeSessionId: input.sessionId,
        stripePaymentIntentId: input.paymentIntentId,
      },
    });
    // Bezahlt: Die Slots gehören jetzt fest der Bestellung.
    await tx.slot.updateMany({
      where: { orderId: order.id },
      data: { reservedUntil: null },
    });
    await tx.kitchenTicket.createMany({
      data: assignTickets(order.slots, order.items).map((t) => ({
        ...t,
        orderId: order.id,
      })),
    });
    await tx.customer.updateMany({
      where: { id: order.customerId, firstOrderAt: null },
      data: { firstOrderAt: now },
    });
    return "accepted";
  }

  // Erstatten: Slots sind weg, die Bestellung wurde storniert oder der Betrag passt nicht.
  if (!input.paymentIntentId) {
    throw new Error(
      `Zahlung zu ${order.id} ohne PaymentIntent – keine Erstattung möglich`,
    );
  }
  const refund = await gateway.refund(
    input.paymentIntentId,
    paidCents,
    // Pro Zahlung ein Schlüssel: Auch eine weitere späte Zahlung wird erstattet.
    `late:${input.paymentIntentId}`,
  );
  await tx.refund.upsert({
    where: { stripeRefundId: refund.id },
    update: {},
    create: {
      orderId: order.id,
      stripeRefundId: refund.id,
      amountCents: paidCents,
      reason: amountMismatch
        ? "Gezahlter Betrag passt nicht zur Bestellung"
        : couponTaken
          ? "Gutschein nach Ablauf der Reservierung vergeben"
          : "Zahlung nach Ablauf der Reservierung",
    },
  });
  await tx.kitchenTicket.deleteMany({ where: { orderId: order.id } });
  await tx.slot.updateMany({
    where: { orderId: order.id },
    data: { orderId: null, reservedUntil: null },
  });
  await tx.order.update({
    where: { id: order.id },
    data: {
      status: "REFUNDED",
      // Eine frühere Zahlung bleibt vermerkt; sonst die erstattete
      stripeSessionId: order.stripeSessionId ?? input.sessionId,
      stripePaymentIntentId:
        order.stripePaymentIntentId ?? input.paymentIntentId,
    },
  });
  return "refunded";
}
