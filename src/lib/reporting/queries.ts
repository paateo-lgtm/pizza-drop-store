import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  exportTable,
  isCancelled,
  salesCurve,
  summarizeOrders,
  topPizzas,
  type Kpis,
  type PizzaRow,
  type ReportFilter,
  type SalesPoint,
} from "@/lib/domain/reporting";

export type Report = { kpis: Kpis; pizzas: PizzaRow[] };

/** Bezahlte Bestellungen im Filter; der Zeitraum gilt für den Backtag des Drops */
function paidOrdersWhere(filter: ReportFilter): Prisma.OrderWhereInput {
  return {
    paidAt: { not: null },
    ...(filter.dropId && { dropId: filter.dropId }),
    ...((filter.from || filter.to) && {
      drop: {
        bakeStartsAt: {
          ...(filter.from && { gte: filter.from }),
          ...(filter.to && { lt: filter.to }),
        },
      },
    }),
  };
}

const ORDER_SELECT = {
  status: true,
  totalCents: true,
  vatCents: true,
  paidAt: true,
  refunds: { select: { amountCents: true } },
  items: {
    select: { nameSnapshot: true, quantity: true, unitPriceCents: true },
  },
} satisfies Prisma.OrderSelect;

type LoadedOrder = Prisma.OrderGetPayload<{ select: typeof ORDER_SELECT }>;

const refundedCents = (o: Pick<LoadedOrder, "refunds">) =>
  o.refunds.reduce((s, r) => s + r.amountCents, 0);

const pizzaCount = (o: LoadedOrder) =>
  o.items.reduce((s, i) => s + i.quantity, 0);

function toReport(orders: LoadedOrder[]): Report {
  const kpis = summarizeOrders(
    orders.map((o) => ({
      status: o.status,
      totalCents: o.totalCents,
      vatCents: o.vatCents,
      refundedCents: refundedCents(o),
      pizzas: pizzaCount(o),
    })),
  );
  const pizzas = topPizzas(
    orders
      .filter((o) => !isCancelled(o.status))
      .flatMap((o) =>
        o.items.map((i) => ({
          name: i.nameSnapshot,
          quantity: i.quantity,
          unitPriceCents: i.unitPriceCents,
        })),
      ),
  );
  return { kpis, pizzas };
}

/** KPIs und Pizzen über alle bezahlten Bestellungen im Filter (Zeitraum = Backtag des Drops) */
export async function loadReport(filter: ReportFilter): Promise<Report> {
  const orders = await db.order.findMany({
    where: paidOrdersWhere(filter),
    select: ORDER_SELECT,
  });
  return toReport(orders);
}

export type DropReport = Report & {
  drop: { id: string; title: string; bakeStartsAt: Date; saleStartsAt: Date };
  capacity: number;
  points: SalesPoint[];
  soldOutAfterMs: number | null;
};

/** Bericht zu einem Drop; Kapazität = Slots ohne Sperre, höchstens `maxPizzasTotal` */
export async function loadDropReport(
  dropId: string,
): Promise<DropReport | null> {
  const found = await db.drop.findUnique({
    where: { id: dropId },
    select: {
      id: true,
      title: true,
      bakeStartsAt: true,
      saleStartsAt: true,
      maxPizzasTotal: true,
    },
  });
  if (!found) return null;
  const { maxPizzasTotal, ...drop } = found;
  const [orders, openSlots] = await Promise.all([
    db.order.findMany({
      where: paidOrdersWhere({ from: null, to: null, dropId }),
      select: ORDER_SELECT,
    }),
    db.slot.count({ where: { dropId, state: "FREE" } }),
  ]);
  const capacity = Math.min(openSlots, maxPizzasTotal ?? Infinity);
  const curve = salesCurve(
    drop.saleStartsAt,
    capacity,
    orders
      .filter((o) => !isCancelled(o.status))
      .map((o) => ({ paidAt: o.paidAt!, pizzas: pizzaCount(o) })),
  );
  return { drop, capacity, ...toReport(orders), ...curve };
}

/** CSV-Zeilen: eine Zeile pro Bestellposition, ohne Kontaktdaten */
export async function exportRows(
  filter: ReportFilter,
): Promise<(string | number | null)[][]> {
  const orders = await db.order.findMany({
    where: paidOrdersWhere(filter),
    orderBy: { number: "asc" },
    select: {
      ...ORDER_SELECT,
      number: true,
      discountCents: true,
      drop: { select: { title: true, bakeStartsAt: true } },
    },
  });
  return exportTable(
    orders.map((o) => ({
      number: o.number,
      dropTitle: o.drop.title,
      bakeStartsAt: o.drop.bakeStartsAt,
      status: o.status,
      paidAt: o.paidAt!,
      discountCents: o.discountCents,
      totalCents: o.totalCents,
      refundedCents: refundedCents(o),
      items: o.items.map((i) => ({
        name: i.nameSnapshot,
        quantity: i.quantity,
        unitPriceCents: i.unitPriceCents,
      })),
    })),
  );
}
