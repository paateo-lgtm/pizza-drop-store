import { describe, expect, it } from "vitest";
import {
  alertMailKey,
  canConfirm,
  confirmMailKey,
  isAlertDue,
  subscribeAction,
} from "./subscription";

describe("subscribeAction", () => {
  it("legt neue Adressen an und schickt bei offenen erneut die Bestätigung", () => {
    expect(subscribeAction(null)).toBe("create");
    expect(subscribeAction("PENDING")).toBe("resend");
  });

  it("startet nach einer Abmeldung neu, bestätigte bleiben unverändert", () => {
    expect(subscribeAction("UNSUBSCRIBED")).toBe("restart");
    expect(subscribeAction("CONFIRMED")).toBe("none");
  });
});

describe("canConfirm", () => {
  it("bestätigt nur offene Anmeldungen", () => {
    expect(canConfirm("PENDING")).toBe(true);
    expect(canConfirm("CONFIRMED")).toBe(false);
    expect(canConfirm("UNSUBSCRIBED")).toBe(false);
  });
});

describe("Mail-Schlüssel", () => {
  it("schickt höchstens eine Bestätigung pro Adresse und Tag", () => {
    const morning = new Date("2026-11-06T06:00:00Z");
    const evening = new Date("2026-11-06T21:00:00Z");
    const nextDay = new Date("2026-11-07T06:00:00Z");
    expect(confirmMailKey("s1", morning)).toBe(confirmMailKey("s1", evening));
    expect(confirmMailKey("s1", morning)).not.toBe(
      confirmMailKey("s1", nextDay),
    );
    expect(confirmMailKey("s1", morning)).not.toBe(
      confirmMailKey("s2", morning),
    );
  });

  it("schickt den Drop-Alarm pro Drop und Abonnent einmal", () => {
    expect(alertMailKey("d1", "s1")).toBe("drop-alarm:d1:s1");
  });
});

describe("isAlertDue", () => {
  const drop = {
    status: "SCHEDULED" as const,
    saleStartsAt: new Date("2026-11-06T10:00:00Z"),
    saleEndsAt: new Date("2026-11-06T16:00:00Z"),
    bakeStartsAt: new Date("2026-11-06T17:00:00Z"),
    bakeEndsAt: new Date("2026-11-06T20:00:00Z"),
  };

  it("ist fällig, sobald der Verkauf läuft", () => {
    expect(isAlertDue(drop, new Date("2026-11-06T09:59:00Z"))).toBe(false);
    expect(isAlertDue(drop, new Date("2026-11-06T10:00:00Z"))).toBe(true);
    // Vom Admin früh geöffnet
    expect(
      isAlertDue(
        { ...drop, status: "ON_SALE" },
        new Date("2026-11-06T08:00:00Z"),
      ),
    ).toBe(true);
  });

  it("ist nicht fällig nach Verkaufsende, als Entwurf oder abgesagt", () => {
    expect(isAlertDue(drop, new Date("2026-11-06T16:00:00Z"))).toBe(false);
    for (const status of ["DRAFT", "CANCELLED"] as const) {
      expect(
        isAlertDue({ ...drop, status }, new Date("2026-11-06T12:00:00Z")),
      ).toBe(false);
    }
  });
});
