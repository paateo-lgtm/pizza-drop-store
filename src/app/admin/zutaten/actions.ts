"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { audit, changedFields } from "@/lib/audit";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { toFormState, type FormState } from "@/lib/validation/common";
import { ingredientSchema } from "@/lib/validation/pizza";

export async function saveIngredient(
  ingredientId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser("pizzas:manage");
  const parsed = ingredientSchema.safeParse({
    name: formData.get("name"),
    unit: formData.get("unit"),
    allergen: formData.get("allergen"),
  });
  if (!parsed.success) return toFormState(parsed.error);

  try {
    if (ingredientId) {
      const before = await db.ingredient.findUniqueOrThrow({
        where: { id: ingredientId },
      });
      await db.ingredient.update({
        where: { id: ingredientId },
        data: parsed.data,
      });
      await audit({
        userId: user.id,
        action: "update",
        entity: "ingredient",
        entityId: ingredientId,
        diff: changedFields(before, parsed.data),
      });
    } else {
      const created = await db.ingredient.create({ data: parsed.data });
      await audit({
        userId: user.id,
        action: "create",
        entity: "ingredient",
        entityId: created.id,
        diff: { name: created.name },
      });
    }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        fieldErrors: { name: ["Diese Zutat gibt es schon"] },
      };
    }
    throw error;
  }

  refresh();
  return { ok: true, message: `„${parsed.data.name}“ gespeichert` };
}

export async function deleteIngredient(
  ingredientId: string,
): Promise<FormState> {
  const user = await requireUser("pizzas:manage");
  const id = z.string().min(1).parse(ingredientId);
  const ingredient = await db.ingredient.findUnique({
    where: { id },
    select: { name: true, _count: { select: { pizzas: true } } },
  });
  if (!ingredient)
    return { ok: false, message: "Diese Zutat gibt es nicht mehr." };
  if (ingredient._count.pizzas > 0) {
    return {
      ok: false,
      message: `„${ingredient.name}“ steckt noch in ${ingredient._count.pizzas} Rezept(en). Entferne sie dort zuerst.`,
    };
  }
  await db.ingredient.delete({ where: { id } });
  await audit({
    userId: user.id,
    action: "delete",
    entity: "ingredient",
    entityId: id,
    diff: { name: ingredient.name },
  });
  refresh();
  return { ok: true, message: `„${ingredient.name}“ gelöscht` };
}
