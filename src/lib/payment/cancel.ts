import "server-only";
import Stripe from "stripe";
import { db } from "@/lib/db";
import { cancellationFor } from "@/lib/domain/payment";
import type { PaymentGateway } from "./gateway";
import { notifySafely, type Notify } from "./notify";

export type CancelResult =
  | {
      ok: true;
      status: "CANCELLED" | "REFUNDED";
      /** Noch offenes Zahlfenster, das danach geschlossen werden sollte */
      stripeSessionId: string | null;
    }
  | { ok: false; message: string };

class Rejection extends Error {}

const TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 };

/**
 * Storno durch den Admin: unter der Drop-Sperre Status setzen, Tickets löschen, Slots
 * freigeben. Bezahlte Bestellungen werden in derselben Transaktion erstattet – scheitert
 * die Erstattung, bleibt die Bestellung unverändert.
 */
export async function cancelOrder(
  orderId: string,
  reason: string | null,
  deps: { gateway: PaymentGateway; notify: Notify },
): Promise<CancelResult> {
  let done: {
    status: "CANCELLED" | "REFUNDED";
    stripeSessionId: string | null;
  };
  try {
    done = await db.$transaction(async (tx) => {
      const found = await tx.order.findUnique({
        where: { id: orderId },
        select: { dropId: true },
      });
      if (!found) throw new Rejection("Diese Bestellung gibt es nicht.");
      await tx.$queryRaw`SELECT id FROM "Drop" WHERE id = ${found.dropId} FOR UPDATE`;

      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
      });
      const plan = cancellationFor(order.status);
      if (!plan) {
        throw new Rejection(
          "Diese Bestellung lässt sich nicht mehr stornieren.",
        );
      }
      if (plan.refund) {
        if (!order.stripePaymentIntentId) {
          throw new Rejection(
            "Zu dieser Bestellung fehlt die Zahlung bei Stripe.",
          );
        }
        const refund = await deps.gateway.refund(
          order.stripePaymentIntentId,
          order.totalCents,
          `cancel:${order.id}`,
        );
        await tx.refund.upsert({
          where: { stripeRefundId: refund.id },
          update: {},
          create: {
            orderId: order.id,
            stripeRefundId: refund.id,
            amountCents: order.totalCents,
            reason,
          },
        });
      }
      await tx.kitchenTicket.deleteMany({ where: { orderId } });
      await tx.slot.updateMany({
        where: { orderId },
        data: { orderId: null, reservedUntil: null },
      });
      await tx.order.update({
        where: { id: orderId },
        data: { status: plan.status },
      });
      return { status: plan.status, stripeSessionId: order.stripeSessionId };
    }, TX_OPTIONS);
  } catch (error) {
    if (error instanceof Rejection)
      return { ok: false, message: error.message };
    console.error(`Storno von ${orderId} fehlgeschlagen`, error);
    return {
      ok: false,
      message:
        error instanceof Stripe.errors.StripeError
          ? `Stripe hat die Erstattung abgelehnt: ${error.message} Die Bestellung bleibt unverändert.`
          : "Das Stornieren hat nicht geklappt. Die Bestellung bleibt unverändert – bitte gleich noch einmal versuchen.",
    };
  }

  await notifySafely(deps.notify, { kind: "cancelled", orderId });
  return { ok: true, ...done };
}
