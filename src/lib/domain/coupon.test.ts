import { describe, expect, it } from "vitest";
import {
  checkCoupon,
  couponDiscount,
  normalizeCouponCode,
  type CouponRule,
} from "./coupon";

const NOW = new Date("2026-11-08T12:00:00Z");

const rule = (over: Partial<CouponRule> = {}): CouponRule => ({
  type: "PERCENT",
  value: 10,
  active: true,
  validFrom: null,
  validTo: null,
  maxRedemptions: null,
  maxPerCustomer: null,
  dropIds: [],
  ...over,
});

const ctx = (over: Partial<Parameters<typeof checkCoupon>[1]> = {}) => ({
  dropId: "d1",
  now: NOW,
  subtotalCents: 2100,
  redemptions: 0,
  customerRedemptions: 0,
  ...over,
});

describe("normalizeCouponCode", () => {
  it("ignoriert Groß-/Kleinschreibung und Leerzeichen", () => {
    expect(normalizeCouponCode("  sommer 10 ")).toBe("SOMMER10");
  });
});

describe("couponDiscount", () => {
  it("rechnet Prozent kaufmännisch gerundet", () => {
    expect(couponDiscount("PERCENT", 15, 2050)).toBe(308);
  });

  it("zieht feste Beträge höchstens bis zur Zwischensumme ab", () => {
    expect(couponDiscount("FIXED", 500, 2100)).toBe(500);
    expect(couponDiscount("FIXED", 5000, 2100)).toBe(2100);
  });
});

describe("checkCoupon", () => {
  it("liefert den Rabatt für einen gültigen Gutschein", () => {
    expect(checkCoupon(rule(), ctx())).toEqual({
      ok: true,
      discountCents: 210,
    });
  });

  it("behandelt unbekannte und deaktivierte Codes gleich", () => {
    const unknown = checkCoupon(null, ctx());
    const inactive = checkCoupon(rule({ active: false }), ctx());
    expect(unknown.ok).toBe(false);
    expect(inactive).toEqual(unknown);
  });

  it("gilt nur im Zeitraum; das Ende zählt noch mit", () => {
    const later = rule({ validFrom: new Date(NOW.getTime() + 1) });
    const ended = rule({ validTo: new Date(NOW.getTime() - 1) });
    const lastMoment = rule({ validTo: NOW });
    expect(checkCoupon(later, ctx())).toMatchObject({
      ok: false,
      message: expect.stringContaining("noch nicht"),
    });
    expect(checkCoupon(ended, ctx())).toMatchObject({
      ok: false,
      message: expect.stringContaining("abgelaufen"),
    });
    expect(checkCoupon(lastMoment, ctx()).ok).toBe(true);
  });

  it("gilt ohne Zuordnung für alle Drops, sonst nur für die gewählten", () => {
    expect(checkCoupon(rule({ dropIds: ["d1", "d2"] }), ctx()).ok).toBe(true);
    expect(checkCoupon(rule({ dropIds: ["d2"] }), ctx())).toMatchObject({
      ok: false,
      message: expect.stringContaining("Drop"),
    });
  });

  it("hält die Grenzen gesamt und pro Kunde ein", () => {
    const limited = rule({ maxRedemptions: 3, maxPerCustomer: 1 });
    expect(checkCoupon(limited, ctx({ redemptions: 2 })).ok).toBe(true);
    expect(checkCoupon(limited, ctx({ redemptions: 3 }))).toMatchObject({
      ok: false,
      message: expect.stringContaining("vollständig eingelöst"),
    });
    expect(
      checkCoupon(limited, ctx({ redemptions: 1, customerRedemptions: 1 })),
    ).toMatchObject({
      ok: false,
      message: expect.stringContaining("schon eingelöst"),
    });
  });

  it("lehnt ab, wenn weniger als 0,50 € zu zahlen blieben (Stripe-Minimum)", () => {
    expect(
      checkCoupon(
        rule({ type: "FIXED", value: 1100 }),
        ctx({ subtotalCents: 1100 }),
      ),
    ).toMatchObject({ ok: false, message: expect.stringContaining("0,50") });
    expect(
      checkCoupon(
        rule({ type: "FIXED", value: 1050 }),
        ctx({ subtotalCents: 1100 }),
      ),
    ).toEqual({ ok: true, discountCents: 1050 });
  });
});
