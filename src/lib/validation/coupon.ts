import { z } from "zod";
import { normalizeCouponCode } from "@/lib/domain/coupon";
import { checkboxField, euroField, localDateTime, optionalInt } from "./common";

const optionalDateTime = z
  .string()
  .trim()
  .transform((v) => v || null)
  .pipe(localDateTime.nullable());

/** Admin-Formular für Gutscheine. Der Wert ist je nach Art Prozent oder Euro. */
export const couponSchema = z
  .object({
    code: z
      .string()
      .transform(normalizeCouponCode)
      .pipe(
        z
          .string()
          .regex(
            /^[A-Z0-9-]{3,30}$/,
            "3 bis 30 Zeichen: Buchstaben, Ziffern oder Bindestrich",
          ),
      ),
    type: z.enum(["PERCENT", "FIXED"]),
    value: z.string().trim(),
    validFrom: optionalDateTime,
    validTo: optionalDateTime,
    maxRedemptions: optionalInt(1, 100_000, "Bitte eine ganze Zahl ab 1"),
    maxPerCustomer: optionalInt(1, 100, "Bitte eine ganze Zahl ab 1"),
    active: checkboxField,
    dropIds: z.array(z.string().min(1).max(40)).max(100),
  })
  .transform((data, ctx) => {
    const value =
      data.type === "PERCENT"
        ? percentValue(data.value)
        : euroField.safeParse(data.value).data;
    if (value === undefined || value === null || value < 1) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message:
          data.type === "PERCENT"
            ? "Bitte ganze Prozent von 1 bis 100"
            : "Bitte einen Betrag ab 0,01 €",
      });
      return z.NEVER;
    }
    return { ...data, value };
  })
  .superRefine((data, ctx) => {
    if (data.validFrom && data.validTo && data.validTo <= data.validFrom) {
      ctx.addIssue({
        code: "custom",
        path: ["validTo"],
        message: "Das Ende muss nach dem Beginn liegen",
      });
    }
    if (
      data.maxRedemptions !== null &&
      data.maxPerCustomer !== null &&
      data.maxPerCustomer > data.maxRedemptions
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["maxPerCustomer"],
        message: "Höchstens so viele wie insgesamt",
      });
    }
  });

function percentValue(input: string): number | undefined {
  if (!/^\d{1,3}$/.test(input)) return undefined;
  const n = Number(input);
  return n <= 100 ? n : undefined;
}

export type CouponInput = z.infer<typeof couponSchema>;

/** FormData → Objekt für couponSchema (Mehrfachauswahl der Drops). */
export function couponFormToObject(formData: FormData) {
  const text = (key: string) => String(formData.get(key) ?? "");
  return {
    code: text("code"),
    type: text("type"),
    value: text("value"),
    validFrom: text("validFrom"),
    validTo: text("validTo"),
    maxRedemptions: text("maxRedemptions"),
    maxPerCustomer: text("maxPerCustomer"),
    active: formData.get("active") ?? undefined,
    dropIds: formData.getAll("dropIds").map(String),
  };
}
