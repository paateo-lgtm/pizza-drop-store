/**
 * Slot-Raster eines Drops: 1 Slot = 1 Pizza, Slotlänge = Zeit pro Pizza.
 * Reine Funktionen ohne Framework- oder Datenbankbezug (siehe docs/PLAN.md, 3.2).
 */

export type SlotTemplate = {
  seq: number;
  startsAt: Date;
  endsAt: Date;
};

export function generateSlots(
  bakeStartsAt: Date,
  bakeEndsAt: Date,
  slotSeconds: number,
): SlotTemplate[] {
  if (!Number.isInteger(slotSeconds) || slotSeconds <= 0) {
    throw new RangeError("slotSeconds muss eine positive ganze Zahl sein");
  }
  const start = bakeStartsAt.getTime();
  const windowMs = bakeEndsAt.getTime() - start;
  if (windowMs <= 0) {
    throw new RangeError("Backzeitraum muss nach dem Start enden");
  }

  const slotMs = slotSeconds * 1000;
  // Ein Rest, der für eine ganze Pizza zu kurz ist, wird abgeschnitten.
  const count = Math.floor(windowMs / slotMs);

  return Array.from({ length: count }, (_, i) => ({
    seq: i + 1,
    startsAt: new Date(start + i * slotMs),
    endsAt: new Date(start + (i + 1) * slotMs),
  }));
}

/**
 * Startpositionen (0-basiert), ab denen `quantity` Slots am Stück frei sind.
 * Eine Bestellung über n Pizzen belegt genau diese n Slots; abgeholt wird am Ende des letzten.
 */
export function findConsecutiveStarts(
  isFree: readonly boolean[],
  quantity: number,
): number[] {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new RangeError("quantity muss mindestens 1 sein");
  }
  const starts: number[] = [];
  let run = 0;
  for (let i = 0; i < isFree.length; i++) {
    run = isFree[i] ? run + 1 : 0;
    if (run >= quantity) {
      starts.push(i - quantity + 1);
    }
  }
  return starts;
}
