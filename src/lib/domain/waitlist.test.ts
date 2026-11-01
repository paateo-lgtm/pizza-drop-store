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
  it("benachrichtigt niemanden, solange nichts frei ist", () => {
    expect(entriesToNotify([entry("a", 1)], slots("ssss"), EARLY, 0)).toEqual(
      [],
    );
  });

  it("geht der Reihe nach und überspringt Einträge, für die keine Folge frei ist", () => {
    const waiting = [entry("a", 3), entry("b", 2), entry("c", 1)];
    expect(entriesToNotify(waiting, slots("sffs"), EARLY, 2)).toEqual(["b"]);
  });

  it("verteilt nur so viele Pizzen, wie frei sind", () => {
    const waiting = [entry("a", 1), entry("b", 1), entry("c", 1)];
    expect(entriesToNotify(waiting, slots("ffss"), EARLY, 2)).toEqual([
      "a",
      "b",
    ]);
  });

  it("verlangt Slots am Stück", () => {
    expect(entriesToNotify([entry("a", 2)], slots("fsfs"), EARLY, 2)).toEqual(
      [],
    );
  });

  it("zählt Slots vor dem frühesten Backbeginn nicht mit", () => {
    const tooSoon = new Date(BASE + 360_000);
    expect(entriesToNotify([entry("a", 2)], slots("ffss"), tooSoon, 2)).toEqual(
      [],
    );
  });

  it("hält sich an die Obergrenze, auch wenn mehr Slots frei sind", () => {
    const waiting = [entry("a", 2), entry("b", 1)];
    expect(entriesToNotify(waiting, slots("ffff"), EARLY, 1)).toEqual(["b"]);
  });
});

describe("waitlistMailKey", () => {
  it("benachrichtigt jeden Eintrag höchstens einmal", () => {
    expect(waitlistMailKey("e1")).toBe(waitlistMailKey("e1"));
    expect(waitlistMailKey("e1")).not.toBe(waitlistMailKey("e2"));
  });
});
