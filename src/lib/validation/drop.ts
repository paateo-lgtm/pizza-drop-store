import { z } from "zod";
import { validateDropTimes } from "@/lib/domain/drops";
import { euroField, localDateTime, optionalInt, slugify } from "./common";

const pizzaRow = z.object({
  pizzaId: z.string().min(1),
  price: z
    .string()
    .trim()
    .transform((v) => v || null)
    .pipe(
      euroField
        .pipe(z.number().min(100, "Mindestens 1,00 €").max(10_000))
        .nullable(),
    ),
  maxQuantity: optionalInt(1, 500, "Kontingent zwischen 1 und 500"),
});

export const dropSchema = z
  .object({
    title: z.string().trim().min(2, "Mindestens 2 Zeichen").max(60),
    slug: z.string().trim().max(60).optional(),
    saleStartsAt: localDateTime,
    saleEndsAt: localDateTime,
    bakeStartsAt: localDateTime,
    bakeEndsAt: localDateTime,
    slotMinutes: z.coerce.number().int().min(0).max(20),
    slotSecondsPart: z.coerce.number().int().min(0).max(59),
    maxPizzasTotal: optionalInt(1, 1000, "Bitte eine ganze Zahl ab 1"),
    maxPizzasPerOrder: z.coerce
      .number()
      .int()
      .min(1, "Mindestens 1")
      .max(20, "Höchstens 20"),
    location: z.string().trim().max(120),
    notes: z.string().trim().max(500),
    pizzas: z.array(pizzaRow).max(50),
  })
  .transform(({ slotMinutes, slotSecondsPart, pizzas, ...data }) => ({
    ...data,
    slug: slugify(data.slug || data.title),
    slotSeconds: slotMinutes * 60 + slotSecondsPart,
    location: data.location || null,
    notes: data.notes || null,
    pizzas: pizzas.map((row) => ({
      pizzaId: row.pizzaId,
      priceOverrideCents: row.price,
      maxQuantity: row.maxQuantity,
    })),
  }))
  .superRefine((data, ctx) => {
    if (!data.slug) {
      ctx.addIssue({
        code: "custom",
        path: ["slug"],
        message: "Ungültiger Titel",
      });
    }
    if (data.slotSeconds < 120 || data.slotSeconds > 1200) {
      ctx.addIssue({
        code: "custom",
        path: ["slotMinutes"],
        message: "Zwischen 2:00 und 20:00 Minuten",
      });
      return;
    }
    if (data.pizzas.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["pizzas"],
        message: "Bitte mindestens eine Pizza auswählen",
      });
    }
    const ids = data.pizzas.map((p) => p.pizzaId);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: "custom",
        path: ["pizzas"],
        message: "Jede Pizza nur einmal pro Drop",
      });
    }
    for (const issue of validateDropTimes(data)) {
      ctx.addIssue({
        code: "custom",
        path: [issue.path],
        message: issue.message,
      });
    }
  });

export type DropInput = z.output<typeof dropSchema>;

/** Liest das Drop-Formular inkl. der Pizza-Zeilen (pizzas.N.pizzaId / price / maxQuantity). */
export function dropFormToObject(formData: FormData) {
  const rows = new Map<string, Record<string, string>>();
  for (const [key, value] of formData.entries()) {
    const match = /^pizzas\.(\d+)\.(pizzaId|price|maxQuantity)$/.exec(key);
    if (match && typeof value === "string") {
      const row = rows.get(match[1]) ?? { price: "", maxQuantity: "" };
      row[match[2]] = value;
      rows.set(match[1], row);
    }
  }
  const text = (key: string) => String(formData.get(key) ?? "");
  return {
    title: text("title"),
    slug: text("slug") || undefined,
    saleStartsAt: text("saleStartsAt"),
    saleEndsAt: text("saleEndsAt"),
    bakeStartsAt: text("bakeStartsAt"),
    bakeEndsAt: text("bakeEndsAt"),
    slotMinutes: text("slotMinutes"),
    slotSecondsPart: text("slotSecondsPart"),
    maxPizzasTotal: text("maxPizzasTotal"),
    maxPizzasPerOrder: text("maxPizzasPerOrder"),
    location: text("location"),
    notes: text("notes"),
    pizzas: [...rows.values()].filter((r) => r.pizzaId),
  };
}
