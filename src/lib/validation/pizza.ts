import { z } from "zod";
import { ALLERGENS } from "@/lib/constants";
import { checkboxField, euroField, slugify } from "./common";

const recipeRow = z.object({
  ingredientId: z.string().min(1),
  amount: z
    .string()
    .trim()
    .transform((v) => Number(v.replace(",", ".")))
    .pipe(z.number().positive("Menge muss größer als 0 sein").max(10_000)),
});

export const pizzaSchema = z
  .object({
    name: z.string().trim().min(2, "Mindestens 2 Zeichen").max(60),
    slug: z.string().trim().max(60).optional(),
    description: z.string().trim().min(5, "Bitte kurz beschreiben").max(300),
    price: euroField.pipe(
      z
        .number()
        .min(100, "Mindestens 1,00 €")
        .max(10_000, "Höchstens 100,00 €"),
    ),
    allergens: z.array(z.enum(ALLERGENS)).default([]),
    tags: z
      .array(z.string().trim().toLowerCase().min(1).max(20))
      .max(8, "Höchstens 8 Tags")
      .default([]),
    active: checkboxField,
    recipe: z.array(recipeRow).max(30).default([]),
  })
  .transform((data) => ({
    ...data,
    slug: slugify(data.slug || data.name),
    tags: [...new Set(data.tags)],
  }))
  .superRefine((data, ctx) => {
    if (!data.slug) {
      ctx.addIssue({
        code: "custom",
        path: ["slug"],
        message: "Ungültiger Name",
      });
    }
    const ids = data.recipe.map((r) => r.ingredientId);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: "custom",
        path: ["recipe"],
        message: "Jede Zutat nur einmal pro Rezept",
      });
    }
  });

export type PizzaInput = z.output<typeof pizzaSchema>;

/** Liest das Pizza-Formular: Mehrfachfelder und Rezeptzeilen (recipe.N.ingredientId / recipe.N.amount). */
export function pizzaFormToObject(formData: FormData) {
  const rows = new Map<string, { ingredientId?: string; amount?: string }>();
  for (const [key, value] of formData.entries()) {
    const match = /^recipe\.(\d+)\.(ingredientId|amount)$/.exec(key);
    if (match && typeof value === "string") {
      const row = rows.get(match[1]) ?? {};
      row[match[2] as "ingredientId" | "amount"] = value;
      rows.set(match[1], row);
    }
  }
  const customTags = String(formData.get("customTags") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  return {
    name: formData.get("name"),
    slug: formData.get("slug") || undefined,
    description: formData.get("description"),
    price: formData.get("price"),
    allergens: formData.getAll("allergens"),
    tags: [...formData.getAll("tags").map(String), ...customTags],
    active: formData.get("active"),
    recipe: [...rows.values()].filter((r) => r.ingredientId || r.amount),
  };
}

export const ingredientSchema = z.object({
  name: z.string().trim().min(2, "Mindestens 2 Zeichen").max(60),
  unit: z.enum(["GRAM", "MILLILITER", "PIECE"]),
  allergen: z
    .union([z.enum(ALLERGENS), z.literal(""), z.null()])
    .transform((v) => v || null),
});
