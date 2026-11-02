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
 * Prüft einen Gutschein innerhalb der Reservierung (nach lockDrop). Sperrt den Gutschein,
 * damit gleichzeitige Bestellungen – auch für andere Drops – die Grenzen nicht überholen.
 */
export async function redeemCoupon(
  tx: Prisma.TransactionClient,
  code: string,
  ctx: {
    dropId: string;
    now: Date;
    subtotalCents: number;
    customerId: string | null;
  },
): Promise<CouponCheck & { couponId?: string }> {
  const found = await tx.coupon.findUnique({
    where: { code },
    select: { id: true },
  });
  if (!found)
    return checkCoupon(null, {
      ...ctx,
      redemptions: 0,
      customerRedemptions: 0,
    });
  await lockCoupon(tx, found.id);
  // Nach der Sperre neu lesen: Der Admin könnte ihn gerade geändert haben.
  const coupon = await tx.coupon.findUniqueOrThrow({
    where: { id: found.id },
    include: { drops: { select: { dropId: true } } },
  });
  const active = activeOrder(ctx.now);
  const redemptions = await tx.order.count({
    where: { couponId: coupon.id, ...active },
  });
  const customerRedemptions = ctx.customerId
    ? await tx.order.count({
        where: { couponId: coupon.id, customerId: ctx.customerId, ...active },
      })
    : 0;
  const check = checkCoupon(
    { ...coupon, dropIds: coupon.drops.map((d) => d.dropId) },
    { ...ctx, redemptions, customerRedemptions },
  );
  return check.ok ? { ...check, couponId: coupon.id } : check;
}
