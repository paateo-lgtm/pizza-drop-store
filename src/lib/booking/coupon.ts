import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { SOLD_ORDER_STATUSES } from "@/lib/domain/booking";
import { checkCoupon, type CouponCheck } from "@/lib/domain/coupon";
import { lockCoupon } from "@/lib/tx";

/** Bestellungen, die eine Einlösung belegen: bezahlt oder Reservierung läuft noch. */
export const activeOrder = (now: Date): Prisma.OrderWhereInput => ({
  OR: [
    { status: { in: SOLD_ORDER_STATUSES } },
    { status: "PENDING_PAYMENT", expiresAt: { gt: now } },
  ],
});

/**
 * Belegte Einlösungen gesamt und für eine E-Mail-Adresse (nach lockCoupon zählen).
 * Pro Adresse statt pro Kundendatensatz: Eine neue Adresse, die parallel zweimal bucht,
 * hat beim Lesen noch keinen Datensatz.
 */
async function countRedemptions(
  tx: Prisma.TransactionClient,
  couponId: string,
  email: string,
  now: Date,
  exceptOrderId?: string,
) {
  const where: Prisma.OrderWhereInput = {
    couponId,
    ...activeOrder(now),
    ...(exceptOrderId ? { id: { not: exceptOrderId } } : {}),
  };
  return {
    redemptions: await tx.order.count({ where }),
    customerRedemptions: await tx.order.count({
      where: { ...where, customer: { email } },
    }),
  };
}

/**
 * Prüft einen Gutschein innerhalb der Reservierung (nach lockDrop). Sperrt den Gutschein,
 * damit gleichzeitige Bestellungen – auch für andere Drops – die Grenzen nicht überholen.
 */
export async function redeemCoupon(
  tx: Prisma.TransactionClient,
  code: string,
  ctx: { dropId: string; now: Date; subtotalCents: number; email: string },
): Promise<CouponCheck & { couponId?: string }> {
  const found = await tx.coupon.findUnique({
    where: { code },
    select: { id: true },
  });
  if (!found) {
    return checkCoupon(null, {
      ...ctx,
      redemptions: 0,
      customerRedemptions: 0,
    });
  }
  await lockCoupon(tx, found.id);
  // Nach der Sperre neu lesen: Der Admin könnte ihn gerade geändert haben.
  const coupon = await tx.coupon.findUniqueOrThrow({
    where: { id: found.id },
    include: { drops: { select: { dropId: true } } },
  });
  const counts = await countRedemptions(tx, coupon.id, ctx.email, ctx.now);
  const check = checkCoupon(
    { ...coupon, dropIds: coupon.drops.map((d) => d.dropId) },
    { ...ctx, ...counts },
  );
  return check.ok ? { ...check, couponId: coupon.id } : check;
}

/**
 * Zahlung nach Ablauf der Reservierung (nach lockDrop): Die Einlösung war in der Zwischenzeit
 * frei und könnte vergeben sein. true = Grenze wäre mit dieser Bestellung überschritten.
 * Zeitraum und Aktiv-Status zählen hier nicht mehr: Bei der Reservierung galten sie.
 */
export async function couponLimitExceeded(
  tx: Prisma.TransactionClient,
  order: { id: string; couponId: string | null; customerId: string },
  now: Date,
): Promise<boolean> {
  if (!order.couponId) return false;
  await lockCoupon(tx, order.couponId);
  const [coupon, customer] = await Promise.all([
    tx.coupon.findUnique({ where: { id: order.couponId } }),
    tx.customer.findUniqueOrThrow({ where: { id: order.customerId } }),
  ]);
  if (!coupon) return false;
  const { redemptions, customerRedemptions } = await countRedemptions(
    tx,
    coupon.id,
    customer.email,
    now,
    order.id,
  );
  return (
    (coupon.maxRedemptions !== null && redemptions >= coupon.maxRedemptions) ||
    (coupon.maxPerCustomer !== null &&
      customerRedemptions >= coupon.maxPerCustomer)
  );
}
