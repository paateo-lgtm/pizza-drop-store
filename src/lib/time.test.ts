import { describe, expect, it } from "vitest";
import { parseBerlinLocal, shiftBerlinDays, toBerlinLocalInput } from "./time";

describe("parseBerlinLocal", () => {
  it("liest Winterzeit (MEZ, UTC+1)", () => {
    expect(parseBerlinLocal("2026-11-06T17:00")).toEqual(
      new Date("2026-11-06T16:00:00Z"),
    );
  });

  it("liest Sommerzeit (MESZ, UTC+2)", () => {
    expect(parseBerlinLocal("2026-07-03T17:30")).toEqual(
      new Date("2026-07-03T15:30:00Z"),
    );
  });

  it("lehnt ungültige Eingaben ab", () => {
    expect(parseBerlinLocal("")).toBeNull();
    expect(parseBerlinLocal("06.11.2026 17:00")).toBeNull();
    expect(parseBerlinLocal("2026-13-01T10:00")).toBeNull();
    expect(parseBerlinLocal("2026-02-30T10:00")).toBeNull();
  });
});

describe("toBerlinLocalInput", () => {
  it("gibt den Wert für datetime-local in Berliner Zeit aus", () => {
    expect(toBerlinLocalInput(new Date("2026-11-06T16:00:00Z"))).toBe(
      "2026-11-06T17:00",
    );
    expect(toBerlinLocalInput(new Date("2026-07-03T15:30:00Z"))).toBe(
      "2026-07-03T17:30",
    );
  });

  it("ist die Umkehrung von parseBerlinLocal", () => {
    const value = "2026-03-29T18:45";
    expect(toBerlinLocalInput(parseBerlinLocal(value)!)).toBe(value);
  });
});

describe("shiftBerlinDays", () => {
  it("behält die Uhrzeit über die Zeitumstellung hinweg", () => {
    // Fr 23.10.2026 17:00 MESZ → Fr 30.10.2026 17:00 MEZ
    const shifted = shiftBerlinDays(new Date("2026-10-23T15:00:00Z"), 7);
    expect(shifted).toEqual(new Date("2026-10-30T16:00:00Z"));
  });

  it("verschiebt auch rückwärts", () => {
    expect(shiftBerlinDays(new Date("2026-11-06T16:00:00Z"), -1)).toEqual(
      new Date("2026-11-05T16:00:00Z"),
    );
  });
});
