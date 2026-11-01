/**
 * Vorbereitungsliste eines Drops aus der Datenbank (siehe docs/PLAN.md, 1.5):
 * Menü mit Rezepten, verkaufte Mengen, Verkauf früherer Drops und Kapazität.
 */
import "server-only";
import { db } from "@/lib/db";
import { SOLD_ORDER_STATUSES } from "@/lib/domain/booking";
import { prepList, type PrepPizza } from "@/lib/domain/prep";
import { getSettings } from "@/lib/settings";

/** Grundlage der Hochrechnung, damit die Küche sie einordnen kann. */
export type PrepBasis = "history" | "current" | "equal";

/** So viele zuletzt gebackene Drops fließen in die Hochrechnung ein. */
const HISTORY_DROPS = 10;

export async function loadPrepList(dropId: string) {
  const now = new Date();
  const [drop, settings] = await Promise.all([
    db.drop.findUnique({
      where: { id: dropId },
      include: {
        pizzas: {
          orderBy: { sortOrder: "asc" },
          include: {
            pizza: {
              include: {
                ingredients: {
                  orderBy: { sortOrder: "asc" },
                  include: { ingredient: true },
                },
              },
            },
          },
        },
        _count: { select: { slots: { where: { state: "FREE" } } } },
      },
    }),
    getSettings(),
  ]);
  if (!drop) return null;

  const pizzaIds = drop.pizzas.map((p) => p.pizzaId);
  // Nur die jüngsten gebackenen Drops: alte Speisekarten sollen die Verteilung nicht prägen.
  const recent = await db.drop.findMany({
    where: { id: { not: dropId }, bakeEndsAt: { lt: now } },
    orderBy: { bakeEndsAt: "desc" },
    take: HISTORY_DROPS,
    select: { id: true },
  });
  const [sold, past] = await Promise.all([
    db.orderItem.groupBy({
      by: ["pizzaId"],
      where: {
        pizzaId: { in: pizzaIds },
        order: { dropId, status: { in: SOLD_ORDER_STATUSES } },
      },
      _sum: { quantity: true },
    }),
    db.orderItem.groupBy({
      by: ["pizzaId"],
      where: {
        pizzaId: { in: pizzaIds },
        order: {
          dropId: { in: recent.map((d) => d.id) },
          status: { in: SOLD_ORDER_STATUSES },
        },
      },
      _sum: { quantity: true },
    }),
  ]);
  const sum = (rows: typeof sold, pizzaId: string) =>
    rows.find((r) => r.pizzaId === pizzaId)?._sum.quantity ?? 0;

  const menu: PrepPizza[] = drop.pizzas.map(({ pizza, maxQuantity }) => ({
    id: pizza.id,
    name: pizza.name,
    sold: sum(sold, pizza.id),
    maxQuantity,
    pastSold: sum(past, pizza.id),
    recipe: pizza.ingredients.map(({ ingredient, amountPerPizza }) => ({
      id: ingredient.id,
      name: ingredient.name,
      unit: ingredient.unit,
      amount: amountPerPizza.toNumber(),
    })),
  }));

  // Gesperrte Slots (Puffer, Pause) backen keine Pizza.
  const capacity = Math.min(drop._count.slots, drop.maxPizzasTotal ?? Infinity);
  const basis: PrepBasis = menu.some((p) => p.pastSold > 0)
    ? "history"
    : menu.some((p) => p.sold > 0)
      ? "current"
      : "equal";

  return {
    drop: {
      id: drop.id,
      title: drop.title,
      bakeStartsAt: drop.bakeStartsAt,
      bakeEndsAt: drop.bakeEndsAt,
    },
    capacity,
    basis,
    bufferPercent: settings.prepBufferPercent,
    list: prepList(menu, capacity, settings.prepBufferPercent),
  };
}

export type PrepView = NonNullable<Awaited<ReturnType<typeof loadPrepList>>>;
