"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/dal";
import { cancelOrder } from "@/lib/payment/cancel";
import { stripeGateway } from "@/lib/payment/gateway";
import { sendOrderNotice } from "@/lib/payment/order-mails";

const input = z.object({
  orderId: z.string().min(1).max(40),
  reason: z
    .string()
    .trim()
    .max(200)
    .transform((v) => v || null),
});

export type CancelState = { ok: boolean; message: string };

/** Storno durch den Admin; bezahlte Bestellungen werden über Stripe erstattet. */
export async function cancelOrderAction(
  orderId: string,
  reason: string,
): Promise<CancelState> {
  const user = await requireUser("orders:manage");
  const parsed = input.safeParse({ orderId, reason });
  if (!parsed.success) return { ok: false, message: "Ungültige Eingabe." };

  const result = await cancelOrder(parsed.data.orderId, parsed.data.reason, {
    gateway: stripeGateway,
    notify: sendOrderNotice,
  });
  if (!result.ok) return result;

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
