/** Anzeige-Helfer für die Kundenseite (ohne Datenbank, auch im Client nutzbar). */
import type { SlotBandState } from "@/components/slot-band";
import type { DropStatus, SlotStatus } from "@/lib/domain/drops";

/** Kunden sehen nur frei, belegt oder Pause – reserviert und verkauft sind für sie gleich. */
export function toBandState(status: SlotStatus): SlotBandState {
  if (status === "free") return "free";
  if (status === "blocked") return "blocked";
  return "taken";
}

/** Pizzen, die der Drop insgesamt anbietet (ohne Puffer, gedeckelt durch die Obergrenze). */
export function offeredPizzas(
  slots: readonly { status: SlotStatus }[],
  maxPizzasTotal: number | null,
) {
  const usable = slots.filter((s) => s.status !== "blocked").length;
  return Math.min(usable, maxPizzasTotal ?? Infinity);
}

export type SaleState =
  "upcoming" | "open" | "soldOut" | "closed" | "baking" | "cancelled";

export function saleState(status: DropStatus, remaining: number): SaleState {
  switch (status) {
    case "SCHEDULED":
      return "upcoming";
    case "ON_SALE":
      return remaining > 0 ? "open" : "soldOut";
    case "LIVE":
      return "baking";
    case "CANCELLED":
      return "cancelled";
    default:
      return "closed";
  }
}

export const SALE_LABELS: Record<SaleState, string> = {
  upcoming: "Bald im Verkauf",
  open: "Verkauf läuft",
  soldOut: "Ausverkauft",
  closed: "Verkauf beendet",
  baking: "Der Ofen läuft",
  cancelled: "Abgesagt",
};

export const pizzaCount = (n: number) => (n === 1 ? "1 Pizza" : `${n} Pizzen`);

/** "6 Minuten" bzw. "5:30 Minuten" */
export const slotLength = (seconds: number) =>
  seconds % 60 === 0
    ? `${seconds / 60} Minuten`
    : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} Minuten`;
