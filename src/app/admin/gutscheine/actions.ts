"use server";

import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { audit, changedFields } from "@/lib/audit";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { toFormState, type FormState } from "@/lib/validation/common";
import { couponFormToObject, couponSchema } from "@/lib/validation/coupon";

/**
 * Legt einen Gutschein an oder ändert ihn. Laufende Reservierungen behalten ihren
 * Rabatt (an der Bestellung gespeichert); neue Einlösungen nutzen die neuen Regeln.
 */
export async function saveCoupon(
  couponId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser("coupons:manage");
  const parsed = couponSchema.safeParse(couponFormToObject(formData));
  if (!parsed.success) return toFormState(parsed.error);
  const { dropIds, ...values } = parsed.data;

  const existing = couponId
    ? await db.coupon.findUnique({
        where: { id: couponId },
        include: { drops: { select: { dropId: true } } },
      })
    : null;
  if (couponId && !existing) {
    return { ok: false, message: "Diesen Gutschein gibt es nicht mehr." };
  }
  const drops = { create: dropIds.map((dropId) => ({ dropId })) };

  try {
    if (existing) {
      await db.coupon.update({
        where: { id: existing.id },
        data: { ...values, drops: { deleteMany: {}, ...drops } },
      });
      await audit({
        userId: user.id,
        action: "update",
        entity: "coupon",
        entityId: existing.id,
        diff: changedFields(
          { ...existing, dropIds: existing.drops.map((d) => d.dropId) },
          { ...values, dropIds },
        ),
      });
    } else {
      const created = await db.coupon.create({ data: { ...values, drops } });
      await audit({
        userId: user.id,
        action: "create",
        entity: "coupon",
        entityId: created.id,
        diff: { code: values.code, type: values.type, value: values.value },
      });
    }
  } catch (error) {
    const known = error instanceof Prisma.PrismaClientKnownRequestError;
    if (known && error.code === "P2002") {
      return {
        ok: false,
        message: "Diesen Code gibt es schon.",
        fieldErrors: { code: ["Bereits vergeben"] },
      };
    }
    if (known && error.code === "P2003") {
      return {
        ok: false,
        message: "Ein gewählter Drop existiert nicht mehr.",
        fieldErrors: { dropIds: ["Bitte die Drops neu wählen"] },
      };
    }
    throw error;
  }

  redirect(`/admin/gutscheine?gespeichert=${encodeURIComponent(values.code)}`);
}
