import { describe, expect, it } from "vitest";
import type { BookingSlot } from "./booking";
import type { SlotStatus } from "./drops";
import { entriesToNotify, waitlistMailKey } from "./waitlist";

const BASE = Date.parse("2026-11-08T17:00:00Z");
const EARLY = new Date(BASE - 3_600_000);

/** Slots à 6 min ab BASE; "f" = frei, "s" = verkauft, "r" = reserviert */
function slots(pattern: string): BookingSlot[] {
  const status: Record<string, SlotStatus> = {
    f: "free",
    s: "sold",
    r: "reserved",
  };
  return [...pattern].map((c, i) => ({
    seq: i + 1,
    startsAt: new Date(BASE + i * 360_000),
    endsAt: new Date(BASE + (i + 1) * 360_000),
    status: status[c],
  }));
}

const entry = (id: string, quantity: number) => ({ id, quantity });

describe("entriesToNotify", () => {
  type Entry = ReturnType<typeof entry>;
  const pick = (
    waiting: Entry[],
    pattern: string,
    available: number,
    options: { promised?: Entry[]; earliest?: Date } = {},
  ) =>
    entriesToNotify({
      waiting,
      promised: options.promised ?? [],
      slots: slots(pattern),
      earliestStart: options.earliest ?? EARLY,
      available,
    });

  it("benachrichtigt niemanden, solange nichts frei ist", () => {
    expect(pick([entry("a", 1)], "ssss", 0)).toEqual([]);
  });

  it("geht der Reihe nach und überspringt Einträge, für die keine Folge frei ist", () => {
    const waiting = [entry("a", 3), entry("b", 2), entry("c", 1)];
    expect(pick(waiting, "sffs", 2)).toEqual(["b"]);
  });

  it("verteilt nur so viele Pizzen, wie frei sind", () => {
    const waiting = [entry("a", 1), entry("b", 1), entry("c", 1)];
    expect(pick(waiting, "ffss", 2)).toEqual(["a", "b"]);
  });

  it("verlangt Slots am Stück", () => {
    expect(pick([entry("a", 2)], "fsfs", 2)).toEqual([]);
  });

  it("zählt Slots vor dem frühesten Backbeginn nicht mit", () => {
    const earliest = new Date(BASE + 360_000);
    expect(pick([entry("a", 2)], "ffss", 2, { earliest })).toEqual([]);
  });

  it("hält sich an die Obergrenze, auch wenn mehr Slots frei sind", () => {
    const waiting = [entry("a", 2), entry("b", 1)];
    expect(pick(waiting, "ffff", 1)).toEqual(["b"]);
  });

  it("gibt Slots, die frisch Benachrichtigten versprochen sind, nicht noch einmal aus", () => {
    const promised = [entry("p", 2)];
    // Nur der Block 1–2 ist frei und versprochen: niemand sonst
    expect(pick([entry("b", 1)], "ffss", 2, { promised })).toEqual([]);
    // Ein einzelner Slot außerhalb des Blocks reicht für einen kleinen Wunsch
    const waiting = [entry("a", 2), entry("b", 1)];
    expect(pick(waiting, "ffsf", 3, { promised })).toEqual(["b"]);
  });

  it("verteilt konkrete Slots: zwei Wünsche teilen sich keinen Block", () => {
    const waiting = [entry("a", 2), entry("b", 2)];
    expect(pick(waiting, "ffsff", 4)).toEqual(["a", "b"]);
    expect(pick(waiting, "fffs", 3)).toEqual(["a"]);
  });
});

describe("waitlistMailKey", () => {
  it("benachrichtigt jeden Eintrag höchstens einmal", () => {
    expect(waitlistMailKey("e1")).toBe(waitlistMailKey("e1"));
    expect(waitlistMailKey("e1")).not.toBe(waitlistMailKey("e2"));
  });
});
