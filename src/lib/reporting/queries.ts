import "server-only";
import type {
  Kpis,
  PizzaRow,
  ReportFilter,
  SalesPoint,
} from "@/lib/domain/reporting";

export type Report = { kpis: Kpis; pizzas: PizzaRow[] };

/** KPIs und Pizzen über alle bezahlten Bestellungen im Filter (Zeitraum = Backtag des Drops) */
export async function loadReport(filter: ReportFilter): Promise<Report> {
  void filter;
  throw new Error("not implemented");
}

export type DropReport = Report & {
  drop: { id: string; title: string; bakeStartsAt: Date; saleStartsAt: Date };
  points: SalesPoint[];
  soldOutAfterMs: number | null;
};

/** Bericht zu einem Drop; Kapazität = Slots ohne Sperre */
export async function loadDropReport(
  dropId: string,
): Promise<DropReport | null> {
  void dropId;
  throw new Error("not implemented");
}

/** CSV-Zeilen: eine Zeile pro Bestellposition, ohne Kontaktdaten */
export async function exportRows(
  filter: ReportFilter,
): Promise<(string | number | null)[][]> {
  void filter;
  throw new Error("not implemented");
}
