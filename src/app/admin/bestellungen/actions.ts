"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { cancelOrder } from "@/lib/payment/cancel";
import { stripeGateway } from "@/lib/payment/gateway";
import type { OrderNotice } from "@/lib/payment/notify";
import { sendOrderNotice } from "@/lib/payment/order-mails";
import { getStripe, isStripeConfigured } from "@/lib/payment/stripe";

const orderId = z.string().min(1).max(40);
const input = z.object({
  orderId,
  reason: z
    .string()
    .trim()
    .max(200)
    .transform((v) => v || null),
});

export type CancelState = { ok: boolean; message: string };

/** Storno durch den Admin; bezahlte Bestellungen werden über Stripe erstattet. */
export async function cancelOrderAction(
  id: string,
  reason: string,
): Promise<CancelState> {
  const user = await requireUser("orders:manage");
  const parsed = input.safeParse({ orderId: id, reason });
  if (!parsed.success) return { ok: false, message: "Ungültige Eingabe." };

  const result = await cancelOrder(parsed.data.orderId, parsed.data.reason, {
    gateway: stripeGateway,
    notify: sendOrderNotice,
  });
  if (!result.ok) return result;

  // Ein noch offenes Zahlfenster schließen, damit niemand mehr bezahlt (sonst würde
  // erstattet). Nur ein Versuch: Abgelaufene Sessions lassen sich nicht schließen.
  if (result.stripeSessionId && isStripeConfigured()) {
    await getStripe()
      .checkout.sessions.expire(result.stripeSessionId)
      .catch(() => undefined);
  }

  await audit({
    userId: user.id,
    action: "cancel",
    entity: "order",
    entityId: parsed.data.orderId,
    diff: { status: result.status, reason: parsed.data.reason },
  });
  refresh();
  return {
    ok: true,
    message:
      result.status === "REFUNDED"
        ? "Storniert und erstattet."
        : "Reservierung storniert.",
  };
}

const KINDS = {
  "order-confirmed": "confirmed",
  "order-refunded": "refunded",
  "order-cancelled": "cancelled",
} as const satisfies Record<string, OrderNotice["kind"]>;

/** Gescheiterte oder übersprungene Kundenmail erneut versenden. */
export async function resendOrderMail(
  id: string,
  kind: string,
): Promise<CancelState> {
  await requireUser("orders:manage");
  const parsed = orderId.safeParse(id);
  if (!parsed.success || !(kind in KINDS)) {
    return { ok: false, message: "Ungültige Eingabe." };
  }
  const exists = await db.order.count({ where: { id: parsed.data } });
  if (!exists) return { ok: false, message: "Diese Bestellung gibt es nicht." };
  try {
    await sendOrderNotice({
      kind: KINDS[kind as keyof typeof KINDS],
      orderId: parsed.data,
    });
  } catch (error) {
    console.error(`Mail zu ${parsed.data} erneut fehlgeschlagen`, error);
    return { ok: false, message: "Der Versand ist wieder fehlgeschlagen." };
  }
  refresh();
  return { ok: true, message: "Mail verschickt (bzw. erneut versucht)." };
}
