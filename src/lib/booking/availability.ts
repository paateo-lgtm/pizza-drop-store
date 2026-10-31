import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import {
  remainingCapacity,
  SOLD_ORDER_STATUSES,
  type BookingSlot,
  type MenuEntry,
} from "@/lib/domain/booking";
import {
  effectiveStatus,
  slotStatus,
  type DropStatus,
} from "@/lib/domain/drops";

type Client = Prisma.TransactionClient;

export type MenuPizza = MenuEntry & {
  description: string;
  imageUrl: string | null;
  allergens: string[];
  tags: string[];
};

export type DropAvailability = {
  drop: {
    id: string;
    slug: string;
    title: string;
    /** Effektiver Status zum Zeitpunkt `now` */
    status: DropStatus;
    saleStartsAt: Date;
    saleEndsAt: Date;
    bakeStartsAt: Date;
    bakeEndsAt: Date;
    slotSeconds: number;
    maxPizzasTotal: number | null;
    maxPizzasPerOrder: number;
    location: string | null;
    notes: string | null;
  };
  menu: MenuPizza[];
  slots: (BookingSlot & { id: string })[];
  /** Pizzen, die der Drop insgesamt noch aufnehmen kann */
  remaining: number;
  /** Frühester Backbeginn einer neuen Bestellung: Die Zahlung muss vorher abgeschlossen sein. */
  earliestStart: Date;
};

/**
 * Aktueller Stand eines Drops für die Buchung. In der Reservierung wird das nach dem
 * Sperren der Drop-Zeile innerhalb der Transaktion gelesen.
 */
export async function loadAvailability(
  client: Client,
  where: { id: string } | { slug: string },
  now: Date,
  reservationMinutes: number,
): Promise<DropAvailability | null> {
  const drop = await client.drop.findUnique({
    where,
    include: {
      pizzas: {
        where: { pizza: { active: true } },
        orderBy: { sortOrder: "asc" },
        include: { pizza: true },
      },
    },
  });
  if (!drop) return null;

  const [slots, taken] = await Promise.all([
    client.slot.findMany({
      where: { dropId: drop.id },
      orderBy: { seq: "asc" },
      include: { order: { select: { status: true } } },
    }),
    client.orderItem.groupBy({
      by: ["pizzaId"],
      where: {
        order: {
          dropId: drop.id,
          OR: [
            { status: { in: SOLD_ORDER_STATUSES } },
            { status: "PENDING_PAYMENT", expiresAt: { gt: now } },
          ],
        },
      },
      _sum: { quantity: true },
    }),
  ]);

  const takenByPizza = new Map(
    taken.map((row) => [row.pizzaId, row._sum.quantity ?? 0]),
  );
  const bookingSlots = slots.map((slot) => ({
    id: slot.id,
    seq: slot.seq,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    status: slotStatus(
      { ...slot, orderStatus: slot.order?.status ?? null },
      now,
    ),
  }));

  return {
    drop: {
      id: drop.id,
      slug: drop.slug,
      title: drop.title,
      status: effectiveStatus(drop, now),
      saleStartsAt: drop.saleStartsAt,
      saleEndsAt: drop.saleEndsAt,
      bakeStartsAt: drop.bakeStartsAt,
      bakeEndsAt: drop.bakeEndsAt,
      slotSeconds: drop.slotSeconds,
      maxPizzasTotal: drop.maxPizzasTotal,
      maxPizzasPerOrder: drop.maxPizzasPerOrder,
      location: drop.location,
      notes: drop.notes,
    },
    menu: drop.pizzas.map((row) => ({
      pizzaId: row.pizzaId,
      name: row.pizza.name,
      unitPriceCents: row.priceOverrideCents ?? row.pizza.priceCents,
      maxQuantity: row.maxQuantity,
      taken: takenByPizza.get(row.pizzaId) ?? 0,
      description: row.pizza.description,
      imageUrl: row.pizza.imageUrl,
      allergens: row.pizza.allergens,
      tags: row.pizza.tags,
    })),
    slots: bookingSlots,
    remaining: remainingCapacity(bookingSlots, drop.maxPizzasTotal),
    earliestStart: new Date(now.getTime() + reservationMinutes * 60_000),
  };
}
