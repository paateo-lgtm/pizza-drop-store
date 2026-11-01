/**
 * Warteliste: Wer wird benachrichtigt, wenn Slots frei werden?
 * Reine Funktionen ohne Framework- oder Datenbankbezug (siehe docs/PLAN.md, 1.6).
 */
import type { BookingSlot } from "./booking";

export type WaitingEntry = { id: string; quantity: number };

export function entriesToNotify(
  _entries: readonly WaitingEntry[],
  _slots: readonly BookingSlot[],
  _earliestStart: Date,
  _available: number,
): string[] {
  throw new Error("noch nicht umgesetzt");
}

export function waitlistMailKey(_entryId: string): string {
  throw new Error("noch nicht umgesetzt");
}
