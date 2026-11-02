/**
 * Kennzahlen fürs Reporting (Phase 8). Reine Funktionen; die Daten lädt `lib/reporting`.
 * chisle: Aggregation in TypeScript, bei Shop-Volumen ausreichend; in SQL verlagern, wenn es wächst.
 */
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

export function summarizeOrders(orders: ReportOrder[]): Kpis {
  void orders;
  throw new Error("not implemented");
}

export type SlotUsage = Record<SlotStatus, number> & {
  /** verkauft / (Slots ohne Sperre) */
  utilization: number;
};

/** Slots je Anzeige-Zustand (aus `slotStatus`) und Auslastung */
export function slotUsage(statuses: SlotStatus[]): SlotUsage {
  void statuses;
  throw new Error("not implemented");
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
  void saleStartsAt;
  void capacity;
  void paid;
  throw new Error("not implemented");
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
  void items;
  throw new Error("not implemented");
}

export type ReportFilter = {
  from: Date | null;
  to: Date | null;
  dropId: string | null;
};

/**
 * Filter aus der URL: `von`/`bis` als Berliner Kalendertag (YYYY-MM-DD), `drop` als ID.
 * `to` ist exklusiv (Beginn des Folgetags). Ungültige Werte fallen weg.
 */
export function parseReportFilter(params: {
  von?: string | string[];
  bis?: string | string[];
  drop?: string | string[];
}): ReportFilter {
  void params;
  throw new Error("not implemented");
}

/**
 * CSV für Excel (DE): Semikolon, CRLF, UTF-8-BOM. Texte, die mit = + - @ beginnen,
 * bekommen ein Hochkomma vorangestellt (Schutz vor Formel-Injektion).
 */
export function toCsv(rows: (string | number | null)[][]): string {
  void rows;
  throw new Error("not implemented");
}
