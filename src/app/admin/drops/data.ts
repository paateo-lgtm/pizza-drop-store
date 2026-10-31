import "server-only";
import { db } from "@/lib/db";
import { slotStatus, type SlotStatus } from "@/lib/domain/drops";
import type { PizzaOption } from "./drop-form";

/** Aktive Pizzen plus die schon zugeordneten (auch wenn sie inzwischen inaktiv sind). */
export async function getPizzaOptions(
  assigned: string[] = [],
): Promise<PizzaOption[]> {
  return db.pizza.findMany({
    where: { OR: [{ active: true }, { id: { in: assigned } }] },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, priceCents: true, active: true },
  });
}

export type SlotRow = {
  id: string;
  seq: number;
  startsAt: Date;
  endsAt: Date;
  status: SlotStatus;
  orderNumber: number | null;
};

export async function getSlotRows(
  dropId: string,
  now: Date,
): Promise<SlotRow[]> {
  const slots = await db.slot.findMany({
    where: { dropId },
    orderBy: { seq: "asc" },
    include: { order: { select: { status: true, number: true } } },
  });
  return slots.map((slot) => {
    const status = slotStatus(
      { ...slot, orderStatus: slot.order?.status ?? null },
      now,
    );
    return {
      id: slot.id,
      seq: slot.seq,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      status,
      orderNumber: status === "free" ? null : (slot.order?.number ?? null),
    };
  });
}
