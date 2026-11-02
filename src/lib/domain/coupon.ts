/**
 * Gutscheine: Gültigkeit und Rabatt. Reine Funktionen ohne Framework- oder
 * Datenbankbezug (siehe docs/PLAN.md, 1.6).
 */

export type CouponType = "PERCENT" | "FIXED";

export type CouponRule = {
  type: CouponType;
  /** Prozent (1–100) oder Betrag in Cent */
  value: number;
  active: boolean;
  validFrom: Date | null;
  validTo: Date | null;
  maxRedemptions: number | null;
  maxPerCustomer: number | null;
  /** Leer = gilt für alle Drops */
  dropIds: string[];
};

export type CouponCheck =
  { ok: true; discountCents: number } | { ok: false; message: string };

export function normalizeCouponCode(_raw: string): string {
  throw new Error("noch nicht umgesetzt");
}

export function couponDiscount(
  _type: CouponType,
  _value: number,
  _subtotalCents: number,
): number {
  throw new Error("noch nicht umgesetzt");
}

export function checkCoupon(
  _coupon: CouponRule | null,
  _ctx: {
    dropId: string;
    now: Date;
    subtotalCents: number;
    redemptions: number;
    customerRedemptions: number;
  },
): CouponCheck {
  throw new Error("noch nicht umgesetzt");
}
