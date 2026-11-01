/**
 * Warteliste: Wer wird benachrichtigt, wenn Slots frei werden?
 * Reine Funktionen ohne Framework- oder Datenbankbezug (siehe docs/PLAN.md, 1.6).
 */
import { pickupOptions, type BookingSlot } from "./booking";

export type WaitingEntry = { id: string; quantity: number };

/**
 * Einträge (älteste zuerst), die jetzt Bescheid bekommen: Für ihre Anzahl muss eine Folge
 * freier Slots buchbar sein, und zusammen dürfen sie nicht mehr Pizzen wollen, als
 * `available` hergibt. Wer nicht passt, wird übersprungen; spätere kleinere Wünsche
 * können trotzdem dran sein. Wer zuerst bucht, bekommt die Slots.
 */
export function entriesToNotify(
  entries: readonly WaitingEntry[],
  slots: readonly BookingSlot[],
  earliestStart: Date,
  available: number,
): string[] {
  const chosen: string[] = [];
  let left = available;
  for (const entry of entries) {
    if (entry.quantity > left) continue;
    if (pickupOptions(slots, entry.quantity, earliestStart).length === 0) {
      continue;
    }
    chosen.push(entry.id);
    left -= entry.quantity;
  }
  return chosen;
}

/** Jeder Eintrag wird höchstens einmal benachrichtigt. */
export function waitlistMailKey(entryId: string): string {
  return `warteliste:${entryId}`;
}
