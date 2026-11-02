import { describe, expect, it } from "vitest";
import { z } from "zod";
import { couponSchema } from "./coupon";

const form = (over: Record<string, unknown> = {}) => ({
  code: "sommer10",
  type: "PERCENT",
  value: "10",
  validFrom: "",
  validTo: "",
  maxRedemptions: "",
  maxPerCustomer: "",
  active: "on",
  dropIds: [],
  ...over,
});

const errors = (
  input: Record<string, unknown>,
): Record<string, string[] | undefined> => {
  const result = couponSchema.safeParse(input);
  return result.success ? {} : z.flattenError(result.error).fieldErrors;
};

describe("couponSchema", () => {
  it("normalisiert den Code und setzt leere Felder auf null", () => {
    expect(couponSchema.parse(form())).toEqual({
      code: "SOMMER10",
      type: "PERCENT",
      value: 10,
      validFrom: null,
      validTo: null,
      maxRedemptions: null,
      maxPerCustomer: null,
      active: true,
      dropIds: [],
    });
  });

  it("liest feste Beträge in Euro und Zeiträume in Berliner Zeit", () => {
    const parsed = couponSchema.parse(
      form({
        type: "FIXED",
        value: "5,50",
        validFrom: "2026-12-01T00:00",
        validTo: "2026-12-24T23:59",
        maxRedemptions: "100",
        maxPerCustomer: "1",
        active: undefined,
        dropIds: ["d1"],
      }),
    );
    expect(parsed).toMatchObject({
      value: 550,
      validFrom: new Date("2026-11-30T23:00:00Z"),
      validTo: new Date("2026-12-24T22:59:00Z"),
      maxRedemptions: 100,
      maxPerCustomer: 1,
      active: false,
      dropIds: ["d1"],
    });
  });

  it("verlangt Prozent zwischen 1 und 100 und Beträge ab 0,01 €", () => {
    expect(errors(form({ value: "0" })).value).toBeDefined();
    expect(errors(form({ value: "101" })).value).toBeDefined();
    expect(errors(form({ value: "12,5" })).value).toBeDefined();
    expect(errors(form({ type: "FIXED", value: "0" })).value).toBeDefined();
  });

  it("erlaubt nur Buchstaben, Ziffern und Bindestrich im Code", () => {
    expect(errors(form({ code: "ab" })).code).toBeDefined();
    expect(errors(form({ code: "SOMMER%" })).code).toBeDefined();
    expect(errors(form({ code: "x".repeat(31) })).code).toBeDefined();
    expect(errors(form({ code: "herbst-26" })).code).toBeUndefined();
  });

  it("prüft Zeitraum und Grenzen auf Widersprüche", () => {
    expect(
      errors(
        form({ validFrom: "2026-12-24T00:00", validTo: "2026-12-01T00:00" }),
      ).validTo,
    ).toBeDefined();
    expect(
      errors(form({ maxRedemptions: "1", maxPerCustomer: "2" })).maxPerCustomer,
    ).toBeDefined();
  });
});
