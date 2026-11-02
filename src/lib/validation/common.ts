import { z } from "zod";
import { parseBerlinLocal } from "@/lib/time";

/** "10,50", "10.5" oder "10" → Cent. Nur positive Beträge mit höchstens zwei Nachkommastellen. */
export function parseEuroToCents(input: string): number | null {
  const normalized = input.trim().replace(/\s|€/g, "").replace(",", ".");
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

export function centsToEuroInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

const UMLAUTS: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", ß: "ss" };

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => UMLAUTS[c])
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export const euroField = z.string().transform((value, ctx) => {
  const cents = parseEuroToCents(value);
  if (cents === null) {
    ctx.addIssue({
      code: "custom",
      message: "Bitte einen Preis wie 10,50 eingeben",
    });
    return z.NEVER;
  }
  return cents;
});

/** Datum und Uhrzeit aus einem datetime-local-Feld, gelesen als Berliner Zeit. */
export const localDateTime = z.string().transform((value, ctx) => {
  const date = parseBerlinLocal(value);
  if (!date) {
    ctx.addIssue({ code: "custom", message: "Bitte Datum und Uhrzeit wählen" });
    return z.NEVER;
  }
  return date;
});

/** Leeres Feld → null, sonst ganze Zahl im Bereich. */
export const optionalInt = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .pipe(
      z
        .number({ error: message })
        .int(message)
        .min(min, message)
        .max(max, message)
        .nullable(),
    );

/** Formular-Checkbox/Switch: "on" bzw. "true" → true, fehlend → false. */
export const checkboxField = z
  .union([
    z.literal("on"),
    z.literal("true"),
    z.literal("false"),
    z.undefined(),
    z.null(),
  ])
  .transform((v) => v === "on" || v === "true");

/** Feldfehler für die Anzeige im Formular. */
export type FieldErrors = Record<string, string[] | undefined>;

export type FormState =
  | {
      ok?: boolean;
      message?: string;
      fieldErrors?: FieldErrors;
    }
  | undefined;

export function toFormState(error: z.ZodError): FormState {
  return {
    ok: false,
    message: "Bitte die markierten Felder prüfen.",
    fieldErrors: z.flattenError(error).fieldErrors as FieldErrors,
  };
}
