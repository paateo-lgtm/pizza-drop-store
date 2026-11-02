import { describe, expect, it } from "vitest";
import {
  parseReportFilter,
  salesCurve,
  slotUsage,
  summarizeOrders,
  toCsv,
  topPizzas,
  type ReportOrder,
} from "./reporting";

const order = (over: Partial<ReportOrder> = {}): ReportOrder => ({
  status: "PICKED_UP",
  totalCents: 2380,
  vatCents: 380,
  refundedCents: 0,
  pizzas: 2,
  ...over,
});

describe("summarizeOrders", () => {
  it("summiert Umsatz, Bestellungen, Pizzen und Ø Bestellwert", () => {
    const kpis = summarizeOrders([
      order(),
      order({ totalCents: 1190, vatCents: 190, pizzas: 1 }),
    ]);
    expect(kpis).toMatchObject({
      orders: 2,
      pizzas: 3,
      grossCents: 3570,
      netCents: 3000,
      avgOrderCents: 1785,
    });
  });

  it("zieht Erstattungen ab, die USt anteilig", () => {
    const kpis = summarizeOrders([
      order({ status: "REFUNDED", refundedCents: 2380 }),
      order({ refundedCents: 1190 }),
    ]);
    expect(kpis.grossCents).toBe(1190);
    expect(kpis.netCents).toBe(1000);
    // Stornierte zählen weder als verkaufte Pizzen noch im Ø Bestellwert
    expect(kpis.pizzas).toBe(2);
    expect(kpis.avgOrderCents).toBe(1190);
  });

  it("berechnet Storno-, Erstattungs- und No-Show-Quote", () => {
    const kpis = summarizeOrders([
      order({ status: "REFUNDED", refundedCents: 2380 }),
      order({ status: "NO_SHOW" }),
      order(),
      order({ refundedCents: 500 }),
    ]);
    expect(kpis.cancelRate).toBe(0.25);
    expect(kpis.refundRate).toBe(0.5);
    // No-Show nur unter den Bestellungen, die abgeholt werden konnten
    expect(kpis.noShowRate).toBeCloseTo(1 / 3);
  });

  it("liefert ohne Bestellungen Nullen statt NaN", () => {
    expect(summarizeOrders([])).toEqual({
      orders: 0,
      pizzas: 0,
      grossCents: 0,
      netCents: 0,
      avgOrderCents: 0,
      cancelRate: 0,
      refundRate: 0,
      noShowRate: 0,
    });
  });
});

describe("slotUsage", () => {
  it("zählt Slots je Zustand; Auslastung ohne gesperrte Slots", () => {
    expect(
      slotUsage(["sold", "sold", "reserved", "blocked", "free", "sold"]),
    ).toEqual({
      sold: 3,
      reserved: 1,
      blocked: 1,
      free: 1,
      utilization: 0.6,
    });
  });

  it("Auslastung 0, wenn alle Slots gesperrt sind", () => {
    expect(slotUsage(["blocked"]).utilization).toBe(0);
    expect(slotUsage([]).utilization).toBe(0);
  });
});

describe("salesCurve", () => {
  const start = new Date("2026-11-05T17:00:00Z");
  const min = (m: number) => new Date(start.getTime() + m * 60_000);

  it("kumuliert nach Zahlungszeit, beginnt beim Verkaufsstart mit 0", () => {
    const { points, soldOutAfterMs } = salesCurve(start, 10, [
      { paidAt: min(30), pizzas: 2 },
      { paidAt: min(5), pizzas: 1 },
    ]);
    expect(points).toEqual([
      { at: start, pizzas: 0 },
      { at: min(5), pizzas: 1 },
      { at: min(30), pizzas: 3 },
    ]);
    expect(soldOutAfterMs).toBeNull();
  });

  it("misst die Zeit bis ausverkauft an der Zahlung, die die Kapazität erreicht", () => {
    const { soldOutAfterMs } = salesCurve(start, 3, [
      { paidAt: min(5), pizzas: 2 },
      { paidAt: min(42), pizzas: 1 },
      { paidAt: min(50), pizzas: 1 },
    ]);
    expect(soldOutAfterMs).toBe(42 * 60_000);
  });

  it("ohne Kapazität nie ausverkauft", () => {
    expect(salesCurve(start, 0, []).soldOutAfterMs).toBeNull();
  });
});

describe("topPizzas", () => {
  it("fasst nach Name zusammen, sortiert nach Stückzahl, mit Umsatz und Anteil", () => {
    expect(
      topPizzas([
        { name: "Margherita", quantity: 1, unitPriceCents: 1050 },
        { name: "Diavola", quantity: 2, unitPriceCents: 1290 },
        { name: "Margherita", quantity: 2, unitPriceCents: 990 },
      ]),
    ).toEqual([
      { name: "Margherita", quantity: 3, revenueCents: 3030, share: 0.6 },
      { name: "Diavola", quantity: 2, revenueCents: 2580, share: 0.4 },
    ]);
  });

  it("leer bei keinen Positionen", () => {
    expect(topPizzas([])).toEqual([]);
  });
});

describe("parseReportFilter", () => {
  it("liest von/bis als Berliner Kalendertage, bis inklusive", () => {
    expect(parseReportFilter({ von: "2026-11-01", bis: "2026-11-07" })).toEqual(
      {
        // Winterzeit: Mitternacht Berlin = 23:00 UTC am Vortag
        from: new Date("2026-10-31T23:00:00Z"),
        to: new Date("2026-11-07T23:00:00Z"),
        dropId: null,
      },
    );
  });

  it("berücksichtigt die Sommerzeit", () => {
    expect(parseReportFilter({ von: "2026-07-01" }).from).toEqual(
      new Date("2026-06-30T22:00:00Z"),
    );
  });

  it("verwirft ungültige Werte", () => {
    expect(
      parseReportFilter({ von: "2026-02-30", bis: "gestern", drop: "x y" }),
    ).toEqual({ from: null, to: null, dropId: null });
    expect(parseReportFilter({})).toEqual({
      from: null,
      to: null,
      dropId: null,
    });
  });

  it("nimmt eine Drop-ID und bei Mehrfachwerten den ersten", () => {
    expect(parseReportFilter({ drop: ["cmabc123", "cmdef456"] }).dropId).toBe(
      "cmabc123",
    );
  });
});

describe("toCsv", () => {
  it("schreibt Excel-taugliches CSV mit BOM, Semikolon und CRLF", () => {
    expect(
      toCsv([
        ["Nr", "Kunde", "Betrag"],
        [1, "Anna", "17,85"],
        [2, null, "9,90"],
      ]),
    ).toBe("﻿Nr;Kunde;Betrag\r\n1;Anna;17,85\r\n2;;9,90\r\n");
  });

  it("setzt Felder mit Trennzeichen, Anführungszeichen oder Umbruch in Anführungszeichen", () => {
    expect(toCsv([['Pizza "Diavola"; scharf', "a\nb"]])).toBe(
      '﻿"Pizza ""Diavola""; scharf";"a\nb"\r\n',
    );
  });

  it("entschärft Texte, die Excel als Formel lesen würde; Zahlen bleiben", () => {
    expect(toCsv([["=HYPERLINK(1)", "+1", "-x", "@SUM(A1)", -5]])).toBe(
      "﻿'=HYPERLINK(1);'+1;'-x;'@SUM(A1);-5\r\n",
    );
  });
});
