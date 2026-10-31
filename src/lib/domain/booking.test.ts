import { describe, expect, it } from "vitest";
import {
  checkCart,
  generatePickupCode,
  isOrderActive,
  PICKUP_CODE_ALPHABET,
  pickupOptions,
  priceBreakdown,
  remainingCapacity,
  type BookingSlot,
  type MenuEntry,
} from "./booking";

const at = (iso: string) => new Date(iso);

/** 6 Slots à 6 min ab 16:00 UTC; `states` legt den Zustand je Slot fest. */
function grid(states: BookingSlot["status"][]): BookingSlot[] {
  const start = at("2026-11-06T16:00:00Z").getTime();
  return states.map((status, i) => ({
    seq: i + 1,
    startsAt: new Date(start + i * 360_000),
    endsAt: new Date(start + (i + 1) * 360_000),
    status,
  }));
}

const BEFORE = at("2026-11-06T12:00:00Z");

describe("pickupOptions", () => {
  it("bietet für 2 Pizzen jede Abholzeit mit 2 freien Slots am Stück an", () => {
    const slots = grid(["free", "free", "sold", "free", "free", "free"]);
    const options = pickupOptions(slots, 2, BEFORE);
    expect(options.map((o) => o.seqs)).toEqual([
      [1, 2],
      [4, 5],
      [5, 6],
    ]);
    expect(options[0]).toMatchObject({
      startSeq: 1,
      bakeStartsAt: at("2026-11-06T16:00:00Z"),
      pickupAt: at("2026-11-06T16:12:00Z"),
    });
  });

  it("behandelt reservierte und gesperrte Slots als belegt", () => {
    const slots = grid(["free", "reserved", "free", "blocked", "free", "free"]);
    expect(pickupOptions(slots, 1, BEFORE).map((o) => o.startSeq)).toEqual([
      1, 3, 5, 6,
    ]);
    expect(pickupOptions(slots, 2, BEFORE).map((o) => o.startSeq)).toEqual([5]);
  });

  it("lässt Slots weg, die vor dem frühesten Backbeginn starten", () => {
    const slots = grid(["free", "free", "free", "free", "free", "free"]);
    // Frühester Beginn 16:10 → Slot 3 (16:12) ist der erste buchbare
    const options = pickupOptions(slots, 2, at("2026-11-06T16:10:00Z"));
    expect(options.map((o) => o.startSeq)).toEqual([3, 4, 5]);
  });

  it("verbindet keine Slots über eine Lücke in der Nummerierung", () => {
    const slots = grid(["free", "free", "free"]).filter((s) => s.seq !== 2);
    expect(pickupOptions(slots, 2, BEFORE)).toEqual([]);
  });

  it("sortiert unabhängig von der Eingabereihenfolge", () => {
    const slots = grid(["free", "free", "free"]).reverse();
    expect(pickupOptions(slots, 1, BEFORE).map((o) => o.startSeq)).toEqual([
      1, 2, 3,
    ]);
  });

  it("liefert nichts für eine Menge unter 1", () => {
    expect(pickupOptions(grid(["free"]), 0, BEFORE)).toEqual([]);
  });
});

describe("remainingCapacity", () => {
  it("zählt ohne Obergrenze die freien Slots", () => {
    const slots = grid(["free", "sold", "reserved", "blocked", "free", "free"]);
    expect(remainingCapacity(slots, null)).toBe(3);
  });

  it("begrenzt auf die Obergrenze abzüglich verkaufter und reservierter Pizzen", () => {
    const slots = grid(["free", "sold", "reserved", "blocked", "free", "free"]);
    expect(remainingCapacity(slots, 4)).toBe(2);
    expect(remainingCapacity(slots, 2)).toBe(0);
    expect(remainingCapacity(slots, 1)).toBe(0);
  });
});

describe("checkCart", () => {
  const menu: MenuEntry[] = [
    {
      pizzaId: "marg",
      name: "Margherita",
      unitPriceCents: 1050,
      maxQuantity: null,
      taken: 0,
    },
    {
      pizzaId: "diav",
      name: "Diavola",
      unitPriceCents: 1250,
      maxQuantity: 5,
      taken: 4,
    },
  ];
  const limits = { maxPerOrder: 4, remaining: 10 };

  it("übernimmt Namen und Preise aus der Karte, nicht vom Client", () => {
    const result = checkCart(
      [
        { pizzaId: "marg", quantity: 2 },
        { pizzaId: "diav", quantity: 1 },
      ],
      menu,
      limits,
    );
    expect(result).toEqual({
      ok: true,
      quantity: 3,
      subtotalCents: 3350,
      items: [
        {
          pizzaId: "marg",
          name: "Margherita",
          unitPriceCents: 1050,
          quantity: 2,
        },
        {
          pizzaId: "diav",
          name: "Diavola",
          unitPriceCents: 1250,
          quantity: 1,
        },
      ],
    });
  });

  it("fasst doppelte Zeilen derselben Pizza zusammen", () => {
    const result = checkCart(
      [
        { pizzaId: "marg", quantity: 1 },
        { pizzaId: "marg", quantity: 2 },
      ],
      menu,
      limits,
    );
    expect(result.ok && result.items).toEqual([
      {
        pizzaId: "marg",
        name: "Margherita",
        unitPriceCents: 1050,
        quantity: 3,
      },
    ]);
  });

  it("lehnt eine leere Bestellung ab", () => {
    expect(checkCart([], menu, limits)).toMatchObject({ ok: false });
  });

  it("lehnt Pizzen ab, die nicht zum Drop gehören", () => {
    expect(
      checkCart([{ pizzaId: "fremd", quantity: 1 }], menu, limits),
    ).toMatchObject({ ok: false, message: expect.stringContaining("Karte") });
  });

  it("hält die Höchstmenge pro Bestellung ein", () => {
    expect(
      checkCart([{ pizzaId: "marg", quantity: 5 }], menu, limits),
    ).toMatchObject({
      ok: false,
      message: "Pro Bestellung sind höchstens 4 Pizzen möglich.",
    });
  });

  it("hält das Kontingent einer Sorte ein", () => {
    expect(
      checkCart([{ pizzaId: "diav", quantity: 2 }], menu, limits),
    ).toMatchObject({
      ok: false,
      message: "Von Diavola ist nur noch 1 übrig.",
    });
  });

  it("meldet eine ausverkaufte Sorte", () => {
    const soldOut = menu.map((m) =>
      m.pizzaId === "diav" ? { ...m, taken: 5 } : m,
    );
    expect(
      checkCart([{ pizzaId: "diav", quantity: 1 }], soldOut, limits),
    ).toMatchObject({ ok: false, message: "Diavola ist ausverkauft." });
  });

  it("hält die verbleibende Gesamtmenge des Drops ein", () => {
    expect(
      checkCart([{ pizzaId: "marg", quantity: 3 }], menu, {
        maxPerOrder: 4,
        remaining: 2,
      }),
    ).toMatchObject({
      ok: false,
      message: "Für diesen Drop sind nur noch 2 Pizzen frei.",
    });
    expect(
      checkCart([{ pizzaId: "marg", quantity: 1 }], menu, {
        maxPerOrder: 4,
        remaining: 0,
      }),
    ).toMatchObject({ ok: false, message: "Dieser Drop ist ausverkauft." });
  });

  it("lehnt Mengen unter 1 und Bruchzahlen ab", () => {
    expect(
      checkCart([{ pizzaId: "marg", quantity: 0 }], menu, limits),
    ).toMatchObject({ ok: false });
    expect(
      checkCart([{ pizzaId: "marg", quantity: 1.5 }], menu, limits),
    ).toMatchObject({ ok: false });
  });
});

describe("priceBreakdown", () => {
  it("weist die enthaltene MwSt. aus (7 % von 33,50 € brutto = 2,19 €)", () => {
    expect(priceBreakdown(3350, 0, 7)).toEqual({
      subtotalCents: 3350,
      discountCents: 0,
      totalCents: 3350,
      vatCents: 219,
    });
  });

  it("zieht den Rabatt ab und rechnet die MwSt. vom Endbetrag", () => {
    expect(priceBreakdown(2000, 500, 7)).toEqual({
      subtotalCents: 2000,
      discountCents: 500,
      totalCents: 1500,
      vatCents: 98,
    });
  });

  it("geht nie unter 0", () => {
    expect(priceBreakdown(1000, 1500, 7)).toMatchObject({
      discountCents: 1000,
      totalCents: 0,
      vatCents: 0,
    });
  });
});

describe("isOrderActive", () => {
  const now = at("2026-11-06T15:00:00Z");
  const later = at("2026-11-06T15:05:00Z");
  const earlier = at("2026-11-06T14:55:00Z");

  it("zählt bezahlte und laufende Bestellungen", () => {
    for (const status of [
      "PAID",
      "IN_PROGRESS",
      "READY",
      "PICKED_UP",
      "NO_SHOW",
    ] as const) {
      expect(isOrderActive(status, earlier, now)).toBe(true);
    }
  });

  it("zählt eine offene Zahlung nur bis zum Ablauf", () => {
    expect(isOrderActive("PENDING_PAYMENT", later, now)).toBe(true);
    expect(isOrderActive("PENDING_PAYMENT", now, now)).toBe(false);
    expect(isOrderActive("PENDING_PAYMENT", earlier, now)).toBe(false);
  });

  it("zählt abgelaufene, stornierte und erstattete Bestellungen nicht", () => {
    for (const status of ["EXPIRED", "CANCELLED", "REFUNDED"] as const) {
      expect(isOrderActive(status, later, now)).toBe(false);
    }
  });
});

describe("generatePickupCode", () => {
  it("erzeugt 6 Zeichen ohne verwechselbare Zeichen", () => {
    for (let i = 0; i < 200; i++) {
      const code = generatePickupCode();
      expect(code).toMatch(/^[A-Z2-9]{6}$/);
      expect(code).not.toMatch(/[01OIL]/);
    }
    expect(PICKUP_CODE_ALPHABET).not.toMatch(/[01OIL]/);
  });

  it("nutzt die übergebene Zufallsquelle", () => {
    const zeros = () => new Uint8Array(6);
    expect(generatePickupCode(zeros)).toBe(PICKUP_CODE_ALPHABET[0].repeat(6));
  });
});
