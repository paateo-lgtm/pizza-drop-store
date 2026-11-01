"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { audit, changedFields } from "@/lib/audit";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import {
  canToggleSlotBlock,
  effectiveStatus,
  isGridLocked,
  slotStatus,
  statusAfter,
  validateDropTimes,
  type DropAction,
} from "@/lib/domain/drops";
import { generateSlots } from "@/lib/domain/slots";
import { shiftBerlinDays } from "@/lib/time";
import { lockDrop } from "@/lib/tx";
import { toFormState, type FormState } from "@/lib/validation/common";
import { dropFormToObject, dropSchema } from "@/lib/validation/drop";

type Tx = Prisma.TransactionClient;

const id = z.string().min(1);

/** Bricht eine Transaktion mit einer Meldung fürs Formular ab. */
class ActionError extends Error {
  constructor(readonly state: NonNullable<FormState>) {
    super(state.message);
  }
}

const GONE = { ok: false, message: "Diesen Drop gibt es nicht mehr." };

/** Raster neu erzeugen; Sperren bleiben an gleicher Uhrzeit erhalten. */
async function rebuildSlots(
  tx: Tx,
  dropId: string,
  grid: { bakeStartsAt: Date; bakeEndsAt: Date; slotSeconds: number },
) {
  const slots = generateSlots(
    grid.bakeStartsAt,
    grid.bakeEndsAt,
    grid.slotSeconds,
  );
  const blocked = await tx.slot.findMany({
    where: { dropId, state: "BLOCKED" },
    select: { startsAt: true },
  });
  const starts = new Set(slots.map((s) => s.startsAt.getTime()));
  const lost = blocked.filter((b) => !starts.has(b.startsAt.getTime())).length;
  if (lost > 0) {
    throw new ActionError({
      ok: false,
      message: `${lost} gesperrte Slots passen nicht ins neue Raster. Bitte gib sie zuerst frei.`,
    });
  }
  const blockedAt = new Set(blocked.map((s) => s.startsAt.getTime()));
  await tx.slot.deleteMany({ where: { dropId } });
  await tx.slot.createMany({
    data: slots.map((slot) => ({
      ...slot,
      dropId,
      state: blockedAt.has(slot.startsAt.getTime()) ? "BLOCKED" : "FREE",
    })),
  });
}

/** Neu zugeordnete Pizzen müssen aktiv sein; bereits zugeordnete dürfen bleiben. */
async function assertPizzasUsable(
  tx: Tx,
  pizzaIds: string[],
  alreadyAssigned: Set<string>,
) {
  const available = await tx.pizza.findMany({
    where: { id: { in: pizzaIds } },
    select: { id: true, active: true },
  });
  const usable = new Set(
    available
      .filter((p) => p.active || alreadyAssigned.has(p.id))
      .map((p) => p.id),
  );
  if (pizzaIds.some((pizzaId) => !usable.has(pizzaId))) {
    throw new ActionError({
      ok: false,
      message: "Eine ausgewählte Pizza ist inaktiv oder gelöscht.",
      fieldErrors: { pizzas: ["Bitte die Auswahl prüfen"] },
    });
  }
}

function isUniqueViolation(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

/** Großzügiger als der Standard (5 s), weil ein Raster bis zu 500 Slots anlegt. */
const TX_OPTIONS = { timeout: 15_000 };

export async function saveDrop(
  dropId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser("drops:manage");
  const parsed = dropSchema.safeParse(dropFormToObject(formData));
  if (!parsed.success) return toFormState(parsed.error);
  const { pizzas, ...values } = parsed.data;
  const pizzaIds = pizzas.map((p) => p.pizzaId);
  const pizzaRows = pizzas.map((p, sortOrder) => ({ ...p, sortOrder }));

  let saved: { id: string; before: Record<string, unknown> | null };
  try {
    saved = await db.$transaction(async (tx) => {
      if (!dropId) {
        await assertPizzasUsable(tx, pizzaIds, new Set());
        const created = await tx.drop.create({
          data: { ...values, pizzas: { create: pizzaRows } },
        });
        await rebuildSlots(tx, created.id, values);
        return { id: created.id, before: null };
      }

      await lockDrop(tx, dropId);
      const existing = await tx.drop.findUnique({
        where: { id: dropId },
        include: {
          pizzas: {
            orderBy: { sortOrder: "asc" },
            select: {
              pizzaId: true,
              priceOverrideCents: true,
              maxQuantity: true,
              sortOrder: true,
            },
          },
        },
      });
      if (!existing) throw new ActionError(GONE);

      const status = effectiveStatus(existing, new Date());
      if (status === "COMPLETED" || status === "CANCELLED") {
        throw new ActionError({
          ok: false,
          message:
            "Abgeschlossene oder abgesagte Drops lassen sich nicht mehr ändern.",
        });
      }
      if (existing.status !== "DRAFT" && values.slug !== existing.slug) {
        // Der Kurzname steht in der Adresse der öffentlichen Drop-Seite.
        throw new ActionError({
          ok: false,
          message:
            "Der Kurzname ist Teil der öffentlichen Adresse und bleibt nach dem Veröffentlichen fix.",
          fieldErrors: { slug: ["Nach dem Veröffentlichen fix"] },
        });
      }
      const gridChanged =
        existing.bakeStartsAt.getTime() !== values.bakeStartsAt.getTime() ||
        existing.bakeEndsAt.getTime() !== values.bakeEndsAt.getTime() ||
        existing.slotSeconds !== values.slotSeconds;
      if (gridChanged && isGridLocked(status)) {
        throw new ActionError({
          ok: false,
          message:
            "Seit Verkaufsstart sind Backzeitraum und Slotlänge fix. Bei Verzug einzelne Slots sperren.",
        });
      }
      if (gridChanged && (await tx.order.count({ where: { dropId } })) > 0) {
        throw new ActionError({
          ok: false,
          message: "Es gibt schon Bestellungen; das Raster bleibt deshalb fix.",
        });
      }
      await assertPizzasUsable(
        tx,
        pizzaIds,
        new Set(existing.pizzas.map((p) => p.pizzaId)),
      );

      await tx.drop.update({
        where: { id: dropId },
        data: { ...values, pizzas: { deleteMany: {}, create: pizzaRows } },
      });
      if (gridChanged) await rebuildSlots(tx, dropId, values);
      return { id: dropId, before: existing };
    }, TX_OPTIONS);
  } catch (error) {
    if (error instanceof ActionError) return error.state;
    if (isUniqueViolation(error)) {
      return {
        ok: false,
        message: "Der Kurzname ist schon vergeben.",
        fieldErrors: { slug: ["Bereits vergeben"] },
      };
    }
    throw error;
  }

  await audit({
    userId: user.id,
    action: saved.before ? "update" : "create",
    entity: "drop",
    entityId: saved.id,
    diff: saved.before
      ? changedFields(saved.before, { ...values, pizzas: pizzaRows })
      : { title: values.title, slotSeconds: values.slotSeconds },
  });
  revalidatePath("/");
  redirect(
    `/admin/drops/${saved.id}?gespeichert=${encodeURIComponent(values.title)}`,
  );
}

/** Bestellungen, die eine Absage blockieren: bezahlt oder mit noch laufender Zahlung. */
function blockingOrders(dropId: string, now: Date): Prisma.OrderWhereInput {
  return {
    dropId,
    OR: [
      { status: { in: ["PAID", "IN_PROGRESS", "READY", "PICKED_UP"] } },
      { status: "PENDING_PAYMENT", expiresAt: { gt: now } },
    ],
  };
}

export async function changeDropStatus(
  dropId: string,
  action: DropAction,
): Promise<FormState> {
  const user = await requireUser("drops:manage");
  const parsedId = id.parse(dropId);
  const parsedAction = z
    .enum([
      "publish",
      "unpublish",
      "openSale",
      "closeSale",
      "complete",
      "cancel",
    ])
    .parse(action);

  let change: { from: string; to: string };
  try {
    change = await db.$transaction(async (tx) => {
      await lockDrop(tx, parsedId);
      const drop = await tx.drop.findUnique({
        where: { id: parsedId },
        include: {
          pizzas: { select: { pizza: { select: { active: true } } } },
        },
      });
      if (!drop) throw new ActionError(GONE);

      const now = new Date();
      const current = effectiveStatus(drop, now);
      const next = statusAfter(current, parsedAction);
      if (!next) {
        throw new ActionError({
          ok: false,
          message: "Das ist im aktuellen Status nicht möglich.",
        });
      }

      const data: Prisma.DropUpdateInput = { status: next };
      if (parsedAction === "publish" || parsedAction === "openSale") {
        const problem =
          drop.pizzas.length === 0
            ? "Bitte zuerst mindestens eine Pizza zuordnen."
            : drop.pizzas.some((p) => !p.pizza.active)
              ? "Der Drop enthält inaktive Pizzen. Bitte entferne sie oder aktiviere sie wieder."
              : drop.bakeEndsAt <= now
                ? "Der Backzeitraum liegt in der Vergangenheit."
                : validateDropTimes(drop).length > 0
                  ? "Bitte zuerst die Zeiten des Drops prüfen."
                  : null;
        if (problem) throw new ActionError({ ok: false, message: problem });
      }
      // Frühes Öffnen oder Schließen verschiebt die Verkaufszeit, damit Anzeige und Status übereinstimmen.
      if (parsedAction === "openSale" && drop.saleStartsAt > now) {
        data.saleStartsAt = now;
      }
      if (parsedAction === "closeSale" && drop.saleEndsAt > now) {
        data.saleEndsAt = now;
      }
      if (
        parsedAction === "cancel" &&
        (await tx.order.count({ where: blockingOrders(drop.id, now) })) > 0
      ) {
        throw new ActionError({
          ok: false,
          message:
            "Es gibt bezahlte oder gerade laufende Bestellungen. Die Absage mit Erstattung folgt mit der Bestellverwaltung.",
        });
      }

      await tx.drop.update({ where: { id: drop.id }, data });
      return { from: current, to: next };
    });
  } catch (error) {
    if (error instanceof ActionError) return error.state;
    throw error;
  }

  await audit({
    userId: user.id,
    action: "status",
    entity: "drop",
    entityId: parsedId,
    diff: change,
  });
  revalidatePath("/");
  refresh();
  return { ok: true };
}

/** Freier Kurzname für eine Kopie; Platz für „-kopie-99“ bleibt innerhalb von 60 Zeichen. */
async function uniqueSlug(source: string) {
  const base = source.slice(0, 51).replace(/-+$/, "");
  for (let n = 1; n < 100; n++) {
    const slug = n === 1 ? `${base}-kopie` : `${base}-kopie-${n}`;
    const taken = await db.drop.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!taken) return slug;
  }
  return `${base.slice(0, 45)}-${Date.now()}`;
}

/** Kopie als Entwurf, eine Woche später zur gleichen Berliner Uhrzeit. */
export async function duplicateDrop(dropId: string): Promise<FormState> {
  const user = await requireUser("drops:manage");
  const source = await db.drop.findUnique({
    where: { id: id.parse(dropId) },
    include: { pizzas: true },
  });
  if (!source) return GONE;

  const shift = (date: Date) => shiftBerlinDays(date, 7);
  const values = {
    title: `${source.title} (Kopie)`.slice(0, 60),
    slug: await uniqueSlug(source.slug),
    saleStartsAt: shift(source.saleStartsAt),
    saleEndsAt: shift(source.saleEndsAt),
    bakeStartsAt: shift(source.bakeStartsAt),
    bakeEndsAt: shift(source.bakeEndsAt),
    slotSeconds: source.slotSeconds,
    maxPizzasTotal: source.maxPizzasTotal,
    maxPizzasPerOrder: source.maxPizzasPerOrder,
    location: source.location,
    notes: source.notes,
  };
  let copyId: string;
  try {
    copyId = await db.$transaction(async (tx) => {
      const created = await tx.drop.create({
        data: {
          ...values,
          pizzas: {
            create: source.pizzas.map((row) => ({
              pizzaId: row.pizzaId,
              priceOverrideCents: row.priceOverrideCents,
              maxQuantity: row.maxQuantity,
              sortOrder: row.sortOrder,
            })),
          },
        },
      });
      await rebuildSlots(tx, created.id, values);
      return created.id;
    }, TX_OPTIONS);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        ok: false,
        message:
          "Gerade wurde eine Kopie angelegt. Bitte noch einmal versuchen.",
      };
    }
    throw error;
  }
  await audit({
    userId: user.id,
    action: "duplicate",
    entity: "drop",
    entityId: copyId,
    diff: { from: source.id },
  });
  redirect(
    `/admin/drops/${copyId}?gespeichert=${encodeURIComponent(values.title)}`,
  );
}

export async function deleteDrop(dropId: string): Promise<FormState> {
  const user = await requireUser("drops:manage");
  const parsedId = id.parse(dropId);

  let title: string;
  try {
    title = await db.$transaction(async (tx) => {
      await lockDrop(tx, parsedId);
      const drop = await tx.drop.findUnique({
        where: { id: parsedId },
        select: {
          title: true,
          status: true,
          _count: { select: { orders: true } },
        },
      });
      if (!drop) throw new ActionError(GONE);
      if (drop.status !== "DRAFT" && drop.status !== "CANCELLED") {
        throw new ActionError({
          ok: false,
          message: "Nur Entwürfe und abgesagte Drops lassen sich löschen.",
        });
      }
      if (drop._count.orders > 0) {
        throw new ActionError({
          ok: false,
          message:
            "Der Drop hat Bestellungen und bleibt für das Reporting erhalten.",
        });
      }
      await tx.drop.delete({ where: { id: parsedId } });
      return drop.title;
    });
  } catch (error) {
    if (error instanceof ActionError) return error.state;
    throw error;
  }
  await audit({
    userId: user.id,
    action: "delete",
    entity: "drop",
    entityId: parsedId,
    diff: { title },
  });
  revalidatePath("/");
  redirect("/admin/drops");
}

/** Freien Slot sperren (Puffer, Pause) oder gesperrten wieder freigeben. */
export async function toggleSlotBlock(slotId: string): Promise<FormState> {
  const user = await requireUser("drops:manage");
  const parsedId = id.parse(slotId);

  const result = await db.$transaction(async (tx) => {
    const found = await tx.slot.findUnique({
      where: { id: parsedId },
      select: { dropId: true },
    });
    if (!found) return null;
    await lockDrop(tx, found.dropId);

    // Erneut lesen: Das Raster kann inzwischen neu erzeugt worden sein.
    const slot = await tx.slot.findUnique({
      where: { id: parsedId },
      include: { order: { select: { status: true } }, drop: true },
    });
    if (!slot) return null;
    const now = new Date();
    const status = slotStatus(
      { ...slot, orderStatus: slot.order?.status ?? null },
      now,
    );
    if (
      !canToggleSlotBlock(
        status,
        slot.startsAt,
        effectiveStatus(slot.drop, now),
        now,
      )
    ) {
      return { blocked: null, dropId: slot.dropId };
    }
    const blocked = status === "free";
    await tx.slot.update({
      where: { id: slot.id },
      // Abgelaufene Reservierungen beim Sperren gleich mit lösen.
      data: blocked
        ? { state: "BLOCKED", orderId: null, reservedUntil: null }
        : { state: "FREE" },
    });
    return { blocked, dropId: slot.dropId };
  });

  if (!result) {
    return {
      ok: false,
      message: "Diesen Slot gibt es nicht mehr. Bitte die Seite neu laden.",
    };
  }
  if (result.blocked === null) {
    return {
      ok: false,
      message: "Dieser Slot ist belegt oder hat schon begonnen.",
    };
  }
  await audit({
    userId: user.id,
    action: result.blocked ? "block" : "unblock",
    entity: "drop",
    entityId: result.dropId,
    diff: { slotId: parsedId },
  });
  revalidatePath("/");
  refresh();
  return { ok: true };
}
