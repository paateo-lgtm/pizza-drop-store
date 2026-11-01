import { describe, expect, it } from "vitest";
import {
  assignTickets,
  canStartPayment,
  cancellationFor,
  decideCheckout,
} from "./payment";

describe("decideCheckout", () => {
  it("nimmt eine offene Zahlung an, wenn die Bestellung ihre Slots hält", () => {
    expect(
      decideCheckout({ status: "PENDING_PAYMENT", heldSlots: 2, quantity: 2 }),
    ).toBe("accept");
  });

  it("nimmt auch eine verspätete Zahlung an, solange die Slots noch frei geblieben sind", () => {
    // Abgelaufen, aber niemand hat die Slots übernommen: sie zeigen noch auf die Bestellung
    expect(
      decideCheckout({ status: "PENDING_PAYMENT", heldSlots: 3, quantity: 3 }),
    ).toBe("accept");
    expect(
      decideCheckout({ status: "EXPIRED", heldSlots: 3, quantity: 3 }),
    ).toBe("accept");
  });

  it("erstattet, wenn die Slots inzwischen vergeben sind", () => {
    expect(
      decideCheckout({ status: "PENDING_PAYMENT", heldSlots: 1, quantity: 2 }),
    ).toBe("refund");
    expect(
      decideCheckout({ status: "EXPIRED", heldSlots: 0, quantity: 2 }),
    ).toBe("refund");
  });

  it("erstattet Zahlungen für stornierte Bestellungen", () => {
    for (const status of ["CANCELLED", "REFUNDED"] as const) {
      expect(decideCheckout({ status, heldSlots: 0, quantity: 1 })).toBe(
        "refund",
      );
    }
  });

  it("ignoriert doppelt zugestellte Events für bezahlte Bestellungen", () => {
    for (const status of [
      "PAID",
      "IN_PROGRESS",
      "READY",
      "PICKED_UP",
      "NO_SHOW",
    ] as const) {
      expect(decideCheckout({ status, heldSlots: 1, quantity: 1 })).toBe(
        "duplicate",
      );
    }
  });
});

describe("assignTickets", () => {
  const slots = [
    { id: "s7", seq: 7 },
    { id: "s5", seq: 5 },
    { id: "s6", seq: 6 },
  ];

  it("verteilt die Pizzen in Positions-Reihenfolge auf die Slots nach seq", () => {
    expect(
      assignTickets(slots, [
        { pizzaId: "marg", quantity: 2 },
        { pizzaId: "diav", quantity: 1 },
      ]),
    ).toEqual([
      { slotId: "s5", seq: 5, pizzaId: "marg" },
      { slotId: "s6", seq: 6, pizzaId: "marg" },
      { slotId: "s7", seq: 7, pizzaId: "diav" },
    ]);
  });

  it("verlangt genau einen Slot pro Pizza", () => {
    expect(() =>
      assignTickets(slots, [{ pizzaId: "marg", quantity: 2 }]),
    ).toThrow();
    expect(() =>
      assignTickets(slots, [{ pizzaId: "marg", quantity: 4 }]),
    ).toThrow();
  });
});

describe("cancellationFor", () => {
  it("storniert offene Zahlungen ohne Erstattung", () => {
    expect(cancellationFor("PENDING_PAYMENT")).toEqual({
      status: "CANCELLED",
      refund: false,
    });
  });

  it("erstattet bezahlte, noch nicht abgeholte Bestellungen", () => {
    for (const status of ["PAID", "IN_PROGRESS", "READY"] as const) {
      expect(cancellationFor(status)).toEqual({
        status: "REFUNDED",
        refund: true,
      });
    }
  });

  it("lässt abgeschlossene Bestellungen unverändert", () => {
    for (const status of [
      "PICKED_UP",
      "NO_SHOW",
      "CANCELLED",
      "REFUNDED",
      "EXPIRED",
    ] as const) {
      expect(cancellationFor(status)).toBeNull();
    }
  });
});

describe("canStartPayment", () => {
  const now = new Date("2026-11-06T15:00:00Z");

  it("erlaubt die Zahlung nur während der Reservierung", () => {
    expect(
      canStartPayment("PENDING_PAYMENT", new Date("2026-11-06T15:05:00Z"), now),
    ).toBe(true);
    expect(canStartPayment("PENDING_PAYMENT", now, now)).toBe(false);
    expect(canStartPayment("PAID", new Date("2026-11-06T15:05:00Z"), now)).toBe(
      false,
    );
  });
});
