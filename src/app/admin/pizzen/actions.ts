"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { audit, changedFields } from "@/lib/audit";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { savePizzaImage, UploadError } from "@/lib/upload";
import { toFormState, type FormState } from "@/lib/validation/common";
import { pizzaFormToObject, pizzaSchema } from "@/lib/validation/pizza";

async function imageFromForm(formData: FormData, current: string | null) {
  if (formData.get("removeImage") === "on") return null;
  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    return savePizzaImage(file);
  }
  return current;
}

function isUniqueViolation(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function savePizza(
  pizzaId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser("pizzas:manage");
  const parsed = pizzaSchema.safeParse(pizzaFormToObject(formData));
  if (!parsed.success) return toFormState(parsed.error);
  const { recipe, price, ...data } = parsed.data;

  const existing = pizzaId
    ? await db.pizza.findUnique({ where: { id: pizzaId } })
    : null;
  if (pizzaId && !existing) {
    return { ok: false, message: "Diese Pizza gibt es nicht mehr." };
  }

  let imageUrl: string | null;
  try {
    imageUrl = await imageFromForm(formData, existing?.imageUrl ?? null);
  } catch (error) {
    if (error instanceof UploadError) {
      return { ok: false, fieldErrors: { image: [error.message] } };
    }
    throw error;
  }

  const ingredientRows = recipe.map((row, i) => ({
    ingredientId: row.ingredientId,
    amountPerPizza: row.amount,
    sortOrder: i,
  }));
  const values = { ...data, priceCents: price, imageUrl };

  let id: string;
  try {
    if (existing) {
      await db.pizza.update({
        where: { id: existing.id },
        data: {
          ...values,
          ingredients: { deleteMany: {}, create: ingredientRows },
        },
      });
      id = existing.id;
      await audit({
        userId: user.id,
        action: "update",
        entity: "pizza",
        entityId: id,
        diff: changedFields(existing, values),
      });
    } else {
      const last = await db.pizza.aggregate({ _max: { sortOrder: true } });
      const created = await db.pizza.create({
        data: {
          ...values,
          sortOrder: (last._max.sortOrder ?? -1) + 1,
          ingredients: { create: ingredientRows },
        },
      });
      id = created.id;
      await audit({
        userId: user.id,
        action: "create",
        entity: "pizza",
        entityId: id,
        diff: { name: values.name, priceCents: values.priceCents },
      });
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        ok: false,
        message: "Name bzw. Kurzname ist schon vergeben.",
        fieldErrors: { slug: ["Bereits vergeben"] },
      };
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return {
        ok: false,
        message: "Eine Zutat im Rezept gibt es nicht mehr.",
        fieldErrors: { recipe: ["Bitte die Zutaten neu auswählen"] },
      };
    }
    throw error;
  }

  revalidatePath("/");
  redirect(`/admin/pizzen?gespeichert=${encodeURIComponent(values.name)}`);
}

export async function setPizzaActive(pizzaId: string, active: boolean) {
  const user = await requireUser("pizzas:manage");
  const id = z.string().min(1).parse(pizzaId);
  await db.pizza.update({ where: { id }, data: { active } });
  await audit({
    userId: user.id,
    action: active ? "activate" : "deactivate",
    entity: "pizza",
    entityId: id,
  });
  revalidatePath("/");
  refresh();
}

export async function reorderPizzas(orderedIds: string[]) {
  const user = await requireUser("pizzas:manage");
  const ids = z.array(z.string().min(1)).max(200).parse(orderedIds);
  await db.$transaction(
    ids.map((id, sortOrder) =>
      db.pizza.update({ where: { id }, data: { sortOrder } }),
    ),
  );
  await audit({ userId: user.id, action: "reorder", entity: "pizza" });
  revalidatePath("/");
  refresh();
}

export async function deletePizza(pizzaId: string): Promise<FormState> {
  const user = await requireUser("pizzas:manage");
  const id = z.string().min(1).parse(pizzaId);
  const usage = await db.pizza.findUnique({
    where: { id },
    select: {
      name: true,
      _count: { select: { orderItems: true, drops: true } },
    },
  });
  if (!usage) return { ok: false, message: "Diese Pizza gibt es nicht mehr." };
  if (usage._count.orderItems > 0 || usage._count.drops > 0) {
    return {
      ok: false,
      message:
        "Die Pizza ist schon in Drops oder Bestellungen verwendet. Deaktiviere sie stattdessen, damit das Reporting vollständig bleibt.",
    };
  }
  await db.pizza.delete({ where: { id } });
  await audit({
    userId: user.id,
    action: "delete",
    entity: "pizza",
    entityId: id,
    diff: { name: usage.name },
  });
  revalidatePath("/");
  redirect("/admin/pizzen");
}
