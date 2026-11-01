/**
 * Warteliste: Wer wird benachrichtigt, wenn Slots frei werden?
 * Reine Funktionen ohne Framework- oder Datenbankbezug (siehe docs/PLAN.md, 1.6).
 */
import { pickupOptions, type BookingSlot } from "./booking";

export type WaitingEntry = { id: string; quantity: number };

/**
 * Einträge (älteste zuerst), die jetzt Bescheid bekommen. Jeder bekommt gedanklich eine
 * konkrete Folge freier Slots (die früheste), damit zwei Benachrichtigte nicht auf
 * denselben Block hoffen. `promised` sind frisch Benachrichtigte: Ihre Slots sind
 * zuerst vergeben. Zusammen gibt es höchstens `available` Pizzen (Obergrenze des Drops).
 * Wer nicht passt, wird übersprungen; spätere kleinere Wünsche können trotzdem dran sein.
 */
export function entriesToNotify(input: {
  waiting: readonly WaitingEntry[];
  promised: readonly WaitingEntry[];
  slots: readonly BookingSlot[];
  earliestStart: Date;
  available: number;
}): string[] {
  let slots = input.slots;
  let left = input.available;
  const take = (entry: WaitingEntry) => {
    if (entry.quantity > left) return false;
    const [option] = pickupOptions(slots, entry.quantity, input.earliestStart);
    if (!option) return false;
    const seqs = new Set(option.seqs);
    slots = slots.map((s) =>
      seqs.has(s.seq) ? { ...s, status: "reserved" as const } : s,
    );
    left -= entry.quantity;
    return true;
  };
  input.promised.forEach(take);
  return input.waiting.filter(take).map((e) => e.id);
}

/** Jeder Eintrag wird höchstens einmal benachrichtigt. */
export function waitlistMailKey(entryId: string): string {
  return `warteliste:${entryId}`;
}
