import { describe, expect, it } from "vitest";
import { generateSlots } from "./slots";

const at = (iso: string) => new Date(iso);

describe("generateSlots", () => {
  it("teilt 15–20 Uhr bei 6 Minuten in 50 Slots", () => {
    const slots = generateSlots(
      at("2026-11-06T14:00:00Z"),
      at("2026-11-06T19:00:00Z"),
      360,
    );
    expect(slots).toHaveLength(50);
    expect(slots[0]).toEqual({
      seq: 1,
      startsAt: at("2026-11-06T14:00:00Z"),
      endsAt: at("2026-11-06T14:06:00Z"),
    });
    expect(slots.at(-1)?.endsAt).toEqual(at("2026-11-06T19:00:00Z"));
  });

  it("schneidet einen zu kurzen Rest ab", () => {
    // 60 min / 5:30 min = 10,9 → 10 Slots
    const slots = generateSlots(
      at("2026-11-06T14:00:00Z"),
      at("2026-11-06T15:00:00Z"),
      330,
    );
    expect(slots).toHaveLength(10);
    expect(slots.at(-1)?.endsAt).toEqual(at("2026-11-06T14:55:00Z"));
  });

  it("bleibt über die Zeitumstellung hinweg lückenlos", () => {
    // 25.10.2026, 00:00–03:00 UTC umfasst den Wechsel von MESZ auf MEZ
    const slots = generateSlots(
      at("2026-10-25T00:00:00Z"),
      at("2026-10-25T03:00:00Z"),
      360,
    );
    expect(slots).toHaveLength(30);
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i].startsAt).toEqual(slots[i - 1].endsAt);
    }
  });

  it("lehnt ungültige Eingaben ab", () => {
    const start = at("2026-11-06T14:00:00Z");
    const end = at("2026-11-06T15:00:00Z");
    expect(() => generateSlots(start, start, 360)).toThrow(RangeError);
    expect(() => generateSlots(start, end, 0)).toThrow(RangeError);
    expect(() => generateSlots(start, end, 5.5)).toThrow(RangeError);
  });
});
