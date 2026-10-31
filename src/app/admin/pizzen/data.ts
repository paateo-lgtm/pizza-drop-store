import "server-only";
import { db } from "@/lib/db";
import type { IngredientOption } from "./pizza-form";

export async function getIngredientOptions(): Promise<IngredientOption[]> {
  return db.ingredient.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, unit: true, allergen: true },
  });
}
