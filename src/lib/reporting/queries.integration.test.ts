import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixtures } from "../../../test/db-fixtures";
import { reserveOrder } from "@/lib/booking/reserve";
import { db } from "@/lib/db";
import { parseReportFilter } from "@/lib/domain/reporting";
import { exportRows, loadDropReport, loadReport } from "./queries";

const RUN = `p8-${Date.now().toString(36)}`;
const f = fixtures(RUN);

let dropA: { id: string; saleStartsAt: Date; bakeStartsAt: Date };
let picked: { id: string; number: number; totalCents: number };
let refunded: { id: string; totalCents: number };

async function order(
  dropId: string,
  customer: number,
  startSeq: number,
  quantity: number,
) {
  const pizza = await db.pizza.findFirstOrThrow({
    where: { slug: `${RUN}-margherita` },
  });
  const result = await reserveOrder({
    ...f.customer(customer),
    dropId,
    startSeq,
    items: [{ pizzaId: pizza.id, quantity }],
  });
  if (!result.ok) throw new Error(result.message);
  return result.orderId;
}

const pay = (id: string, status: "PICKED_UP" | "REFUNDED", paidAt: Date) =>
  db.order.update({ where: { id }, data: { status, paidAt } });

beforeAll(async () => {
  const pizza = await f.pizza("Margherita", 1000);
  dropA = await f.drop("a", 6, [pizza.id]);
  const dropB = await f.drop("b", 2, [pizza.id]);
  const minutes = (m: number) =>
    new Date(dropA.saleStartsAt.getTime() + m * 60_000);

  picked = await pay(await order(dropA.id, 1, 1, 2), "PICKED_UP", minutes(5));
  refunded = await pay(await order(dropA.id, 2, 3, 1), "REFUNDED", minutes(9));
  await db.refund.create({
    data: { orderId: refunded.id, amountCents: refunded.totalCents },
  });
  await order(dropA.id, 3, 4, 1); // unbezahlt, zählt nicht
  await pay(await order(dropB.id, 4, 1, 1), "PICKED_UP", minutes(7));
});

afterAll(async () => {
  await f.cleanup();
  await db.$disconnect();
});

describe("loadReport", () => {
  it("zählt nur bezahlte Bestellungen des gefilterten Drops", async () => {
    const { kpis, pizzas } = await loadReport(
      parseReportFilter({ drop: dropA.id }),
    );
    expect(kpis).toMatchObject({
      orders: 2,
      pizzas: 2,
      grossCents: picked.totalCents,
      avgOrderCents: picked.totalCents,
      cancelRate: 0.5,
      refundRate: 0.5,
      noShowRate: 0,
    });
    expect(pizzas).toEqual([
      expect.objectContaining({ name: "Margherita", quantity: 2, share: 1 }),
    ]);
  });

  it("filtert nach Backtag (Berliner Kalendertag)", async () => {
    const day = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Berlin",
    }).format(dropA.bakeStartsAt);
    const hit = await loadReport(
      parseReportFilter({ drop: dropA.id, von: day, bis: day }),
    );
    expect(hit.kpis.orders).toBe(2);
    const before = await loadReport(
      parseReportFilter({ drop: dropA.id, bis: "2020-01-01" }),
    );
    expect(before.kpis.orders).toBe(0);
  });
});

describe("loadDropReport", () => {
  it("liefert Verkaufsverlauf ohne stornierte Bestellungen", async () => {
    const report = await loadDropReport(dropA.id);
    expect(report?.drop.id).toBe(dropA.id);
    expect(report?.points.map((p) => p.pizzas)).toEqual([0, 2]);
    expect(report?.soldOutAfterMs).toBeNull();
  });

  it("null für unbekannte Drops", async () => {
    expect(await loadDropReport("gibt-es-nicht")).toBeNull();
  });
});

describe("exportRows", () => {
  it("eine Zeile pro Position mit Kopfzeile, ohne Kontaktdaten", async () => {
    const [header, ...rows] = await exportRows(
      parseReportFilter({ drop: dropA.id }),
    );
    expect(header).toContain("Bestellung");
    expect(rows).toHaveLength(2);
    const row = rows.find((r) => r[0] === picked.number)!;
    expect(row).toContain("Margherita");
    expect(row).toContain(2);
    expect(JSON.stringify(rows)).not.toMatch(/@|Gast/);
  });
});
