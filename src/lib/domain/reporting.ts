/**
 * Kennzahlen fürs Reporting (Phase 8). Reine Funktionen; die Daten lädt `lib/reporting`.
 * chisle: Aggregation in TypeScript, bei Shop-Volumen ausreichend; in SQL verlagern, wenn es wächst.
 */
import { TZDate } from "@date-fns/tz";
import { TIME_ZONE } from "@/lib/time";
import type { OrderStatus, SlotStatus } from "./drops";

/** Bezahlte Bestellung (paidAt gesetzt) mit Erstattungen und Stückzahl */
export type ReportOrder = {
  status: OrderStatus;
  totalCents: number;
  vatCents: number;
  refundedCents: number;
  pizzas: number;
};

export type Kpis = {
  orders: number;
  pizzas: number;
  grossCents: number;
  netCents: number;
  avgOrderCents: number;
  cancelRate: number;
  refundRate: number;
  noShowRate: number;
};

/** Nach der Zahlung storniert (Admin-Storno oder späte Zahlung) */
export const isCancelled = (status: OrderStatus) =>
  status === "CANCELLED" || status === "REFUNDED";

const ratio = (part: number, whole: number) => (whole === 0 ? 0 : part / whole);

export function summarizeOrders(orders: ReportOrder[]): Kpis {
  let pizzas = 0;
  let grossCents = 0;
  let netCents = 0;
  let cancelled = 0;
  let refunded = 0;
  let pickedUp = 0;
  let noShow = 0;
  let soldCents = 0;
  for (const o of orders) {
    if (o.refundedCents > 0) refunded++;
    // Erstattungen bei nicht stornierten Bestellungen gelten heute nur Doppelzahlungen
    // (zweites Geld rein und wieder raus) und ändern den Umsatz nicht.
    // chisle: bei Teilerstattungen auf aktive Bestellungen braucht Refund eine Art.
    const cancelledOrder = isCancelled(o.status);
    const kept = cancelledOrder
      ? o.totalCents - o.refundedCents
      : o.totalCents;
    grossCents += kept;
    netCents +=
      kept -
      (o.totalCents === 0 ? 0 : Math.round((o.vatCents * kept) / o.totalCents));
    if (cancelledOrder) {
      cancelled++;
      continue;
    }
    soldCents += kept;
    pizzas += o.pizzas;
    if (o.status === "PICKED_UP") pickedUp++;
    if (o.status === "NO_SHOW") noShow++;
  }
  const sold = orders.length - cancelled;
  return {
    orders: orders.length,
    pizzas,
    grossCents,
    netCents,
    avgOrderCents: sold === 0 ? 0 : Math.round(soldCents / sold),
    cancelRate: ratio(cancelled, orders.length),
    refundRate: ratio(refunded, orders.length),
    noShowRate: ratio(noShow, pickedUp + noShow),
  };
}

export type SlotUsage = Record<SlotStatus, number> & {
  /** verkauft / (Slots ohne Sperre) */
  utilization: number;
};

/** Slots je Anzeige-Zustand (aus `slotStatus`) und Auslastung */
export function slotUsage(statuses: SlotStatus[]): SlotUsage {
  const count = { sold: 0, reserved: 0, blocked: 0, free: 0 };
  for (const s of statuses) count[s]++;
  return {
    ...count,
    utilization: ratio(count.sold, statuses.length - count.blocked),
  };
}

export type SalesPoint = { at: Date; pizzas: number };

/**
 * Kumulierter Verkauf nach Zahlungszeit und Zeit bis ausverkauft (ms ab Verkaufsstart,
 * null solange nicht ausverkauft).
 */
export function salesCurve(
  saleStartsAt: Date,
  capacity: number,
  paid: { paidAt: Date; pizzas: number }[],
): { points: SalesPoint[]; soldOutAfterMs: number | null } {
  const points: SalesPoint[] = [{ at: saleStartsAt, pizzas: 0 }];
  let soldOutAfterMs: number | null = null;
  let total = 0;
  for (const p of [...paid].sort((a, b) => +a.paidAt - +b.paidAt)) {
    total += p.pizzas;
    points.push({ at: p.paidAt, pizzas: total });
    if (soldOutAfterMs === null && capacity > 0 && total >= capacity) {
      soldOutAfterMs = +p.paidAt - +saleStartsAt;
    }
  }
  return { points, soldOutAfterMs };
}

export type PizzaRow = {
  name: string;
  quantity: number;
  revenueCents: number;
  share: number;
};

/** Nach Stückzahl absteigend; Anteil an allen verkauften Pizzen */
export function topPizzas(
  items: { name: string; quantity: number; unitPriceCents: number }[],
): PizzaRow[] {
  const byName = new Map<string, { quantity: number; revenueCents: number }>();
  let total = 0;
  for (const i of items) {
    const row = byName.get(i.name) ?? { quantity: 0, revenueCents: 0 };
    row.quantity += i.quantity;
    row.revenueCents += i.quantity * i.unitPriceCents;
    byName.set(i.name, row);
    total += i.quantity;
  }
  return [...byName]
    .map(([name, r]) => ({ name, ...r, share: ratio(r.quantity, total) }))
    .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name));
}

export type ReportFilter = {
  from: Date | null;
  to: Date | null;
  dropId: string | null;
};

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
// IDs sind cuids, in Tests auch UUIDs
const ID = /^[A-Za-z0-9_-]{1,64}$/;

const first = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

/** Beginn eines Berliner Kalendertags; `plusDays` verschiebt um ganze Tage */
function berlinDay(value: string | undefined, plusDays = 0): Date | null {
  const match = value ? DAY.exec(value) : null;
  if (!match) return null;
  const [y, m, d] = match.slice(1).map(Number);
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  return new Date(new TZDate(y, m - 1, d + plusDays, TIME_ZONE).getTime());
}

/**
 * Filter aus der URL: `von`/`bis` als Berliner Kalendertag (YYYY-MM-DD), `drop` als ID.
 * `to` ist exklusiv (Beginn des Folgetags). Ungültige Werte fallen weg.
 */
export function parseReportFilter(params: {
  von?: string | string[];
  bis?: string | string[];
  drop?: string | string[];
}): ReportFilter {
  const drop = first(params.drop);
  return {
    from: berlinDay(first(params.von)),
    to: berlinDay(first(params.bis), 1),
    dropId: drop && ID.test(drop) ? drop : null,
  };
}

const FORMULA = /^[=+\-@\t\r]/;

function csvField(value: string | number | null): string {
  if (value === null) return "";
  if (typeof value === "number") return String(value);
  const safe = FORMULA.test(value) ? `'${value}` : value;
  return /[;"\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/**
 * CSV für Excel (DE): Semikolon, CRLF, UTF-8-BOM. Texte, die mit = + - @ beginnen,
 * bekommen ein Hochkomma vorangestellt (Schutz vor Formel-Injektion).
 */
export function toCsv(rows: (string | number | null)[][]): string {
  return "﻿" + rows.map((r) => r.map(csvField).join(";") + "\r\n").join("");
}

export type ExportOrder = {
  number: number;
  dropTitle: string;
  bakeStartsAt: Date;
  status: OrderStatus;
  paidAt: Date;
  discountCents: number;
  totalCents: number;
  refundedCents: number;
  items: { name: string; quantity: number; unitPriceCents: number }[];
};

/**
 * Tabelle für den CSV-Export: Kopfzeile plus eine Zeile pro Position. Bestellbeträge stehen
 * nur in der ersten Zeile einer Bestellung, Beträge ohne Tausenderpunkt.
 */
export function exportTable(
  orders: ExportOrder[],
): (string | number | null)[][] {
  const header = [
    "Bestellung",
    "Drop",
    "Backtag",
    "Status",
    "Bezahlt",
    "Pizza",
    "Menge",
    "Einzelpreis €",
    "Zeilensumme €",
    "Rabatt €",
    "Summe €",
    "Erstattet €",
  ];
  return [
    header,
    ...orders.flatMap((o) =>
      o.items.map((i, index) => [
        o.number,
        o.dropTitle,
        csvDay.format(o.bakeStartsAt),
        o.status,
        `${csvDay.format(o.paidAt)} ${csvTime.format(o.paidAt)}`,
        i.name,
        i.quantity,
        csvEuro(i.unitPriceCents),
        csvEuro(i.quantity * i.unitPriceCents),
        index === 0 ? csvEuro(o.discountCents) : null,
        index === 0 ? csvEuro(o.totalCents) : null,
        index === 0 ? csvEuro(o.refundedCents) : null,
      ]),
    ),
  ];
}

const csvDay = new Intl.DateTimeFormat("de-DE", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const csvTime = new Intl.DateTimeFormat("de-DE", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});
/** 1234,50 – ohne Tausenderpunkt, damit Excel (DE) eine Zahl erkennt */
const csvEuro = (cents: number) =>
  (cents / 100).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  });
