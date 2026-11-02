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

/** Kleinster Betrag, den Stripe in Euro abrechnet. */
export const MIN_CHARGE_CENTS = 50;

/** Codes werden großgeschrieben und ohne Leerzeichen gespeichert und verglichen. */
export function normalizeCouponCode(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

export function couponDiscount(
  type: CouponType,
  value: number,
  subtotalCents: number,
): number {
  const discount =
    type === "PERCENT" ? Math.round((subtotalCents * value) / 100) : value;
  return Math.min(Math.max(0, discount), subtotalCents);
}

/**
 * Darf der Gutschein für diese Bestellung eingelöst werden? `redemptions` zählt
 * aktive Bestellungen mit diesem Gutschein (bezahlt oder Reservierung läuft),
 * `customerRedemptions` davon die der Person.
 */
export function checkCoupon(
  coupon: CouponRule | null,
  ctx: {
    dropId: string;
    now: Date;
    subtotalCents: number;
    redemptions: number;
    customerRedemptions: number;
  },
): CouponCheck {
  const fail = (message: string): CouponCheck => ({ ok: false, message });
  // Deaktiviert wie unbekannt: verrät nicht, welche Codes es einmal gab.
  if (!coupon || !coupon.active) {
    return fail("Diesen Gutscheincode kennen wir nicht.");
  }
  const t = ctx.now.getTime();
  if (coupon.validFrom && t < coupon.validFrom.getTime()) {
    return fail("Dieser Gutschein gilt noch nicht.");
  }
  if (coupon.validTo && t > coupon.validTo.getTime()) {
    return fail("Dieser Gutschein ist abgelaufen.");
  }
  if (coupon.dropIds.length > 0 && !coupon.dropIds.includes(ctx.dropId)) {
    return fail("Dieser Gutschein gilt nicht für diesen Drop.");
  }
  if (
    coupon.maxRedemptions !== null &&
    ctx.redemptions >= coupon.maxRedemptions
  ) {
    return fail("Dieser Gutschein ist bereits vollständig eingelöst.");
  }
  if (
    coupon.maxPerCustomer !== null &&
    ctx.customerRedemptions >= coupon.maxPerCustomer
  ) {
    return fail("Du hast diesen Gutschein schon eingelöst.");
  }
  const discountCents = couponDiscount(
    coupon.type,
    coupon.value,
    ctx.subtotalCents,
  );
  // chisle: kostenlose Bestellungen ohne Stripe erst bei Bedarf (z. B. Gewinnspiel)
  if (ctx.subtotalCents - discountCents < MIN_CHARGE_CENTS) {
    return fail(
      "Mit diesem Gutschein blieben weniger als 0,50 € – so kleine Beträge können wir online nicht abrechnen.",
    );
  }
  return { ok: true, discountCents };
}
