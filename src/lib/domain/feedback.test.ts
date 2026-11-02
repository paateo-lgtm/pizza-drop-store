import { describe, expect, it } from "vitest";
import { feedbackMailKey, feedbackState, isFeedbackDue } from "./feedback";

const NOW = new Date("2026-11-08T20:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

const order = (over: Partial<Parameters<typeof isFeedbackDue>[0]> = {}) => ({
  status: "PICKED_UP" as const,
  feedbackConsent: true,
  pickedUpAt: hoursAgo(4),
  hasFeedback: false,
  ...over,
});

describe("isFeedbackDue", () => {
  it("fragt einige Stunden nach der Abholung, nur mit Einwilligung", () => {
    expect(isFeedbackDue(order(), NOW)).toBe(true);
    expect(isFeedbackDue(order({ feedbackConsent: false }), NOW)).toBe(false);
  });

  it("wartet die ersten drei Stunden ab", () => {
    expect(isFeedbackDue(order({ pickedUpAt: hoursAgo(2.9) }), NOW)).toBe(
      false,
    );
    expect(isFeedbackDue(order({ pickedUpAt: hoursAgo(3) }), NOW)).toBe(true);
  });

  it("fragt nach drei Tagen nicht mehr (z. B. alte Bestellungen beim Start)", () => {
    expect(isFeedbackDue(order({ pickedUpAt: hoursAgo(71) }), NOW)).toBe(true);
    expect(isFeedbackDue(order({ pickedUpAt: hoursAgo(73) }), NOW)).toBe(false);
  });

  it("fragt nur bei abgeholten Bestellungen ohne Bewertung", () => {
    expect(isFeedbackDue(order({ status: "NO_SHOW" }), NOW)).toBe(false);
    expect(isFeedbackDue(order({ pickedUpAt: null }), NOW)).toBe(false);
    expect(isFeedbackDue(order({ hasFeedback: true }), NOW)).toBe(false);
  });
});

describe("feedbackState", () => {
  it("ist 30 Tage nach der Abholung offen, danach geschlossen", () => {
    expect(feedbackState(order({ pickedUpAt: hoursAgo(1) }), NOW)).toBe("open");
    expect(feedbackState(order({ pickedUpAt: hoursAgo(24 * 29) }), NOW)).toBe(
      "open",
    );
    expect(feedbackState(order({ pickedUpAt: hoursAgo(24 * 31) }), NOW)).toBe(
      "closed",
    );
  });

  it("nimmt pro Bestellung nur eine Bewertung an, nur nach Abholung", () => {
    expect(feedbackState(order({ hasFeedback: true }), NOW)).toBe("done");
    expect(
      feedbackState(order({ status: "PAID", pickedUpAt: null }), NOW),
    ).toBe("closed");
  });
});

describe("feedbackMailKey", () => {
  it("fragt pro Bestellung höchstens einmal", () => {
    expect(feedbackMailKey("o1")).toBe(feedbackMailKey("o1"));
    expect(feedbackMailKey("o1")).not.toBe(feedbackMailKey("o2"));
  });
});
