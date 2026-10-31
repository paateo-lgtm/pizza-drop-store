import { describe, expect, it } from "vitest";
import {
  canToggleSlotBlock,
  describeGrid,
  dropActions,
  effectiveStatus,
  isGridLocked,
  slotStatus,
  statusAfter,
  validateDropTimes,
  type DropTimes,
} from "./drops";

const at = (iso: string) => new Date(iso);

// Verkauf Mo–Fr 16 Uhr, Backen Fr 17–20 Uhr (UTC-Werte, MEZ = UTC+1)
const times: DropTimes = {
  saleStartsAt: at("2026-11-02T09:00:00Z"),
  saleEndsAt: at("2026-11-06T15:00:00Z"),
  bakeStartsAt: at("2026-11-06T16:00:00Z"),
  bakeEndsAt: at("2026-11-06T19:00:00Z"),
};

describe("effectiveStatus", () => {
  const published = { ...times, status: "SCHEDULED" as const };

  it.each([
    ["2026-11-01T12:00:00Z", "SCHEDULED"],
    ["2026-11-02T09:00:00Z", "ON_SALE"],
    ["2026-11-06T15:00:00Z", "SALE_CLOSED"],
    ["2026-11-06T16:30:00Z", "LIVE"],
    ["2026-11-06T19:00:00Z", "COMPLETED"],
  ])("geplanter Drop am %s ist %s", (now, expected) => {
    expect(effectiveStatus(published, at(now))).toBe(expected);
  });

  it("lässt Entwurf und Absage unabhängig von der Zeit stehen", () => {
    const now = at("2026-11-06T16:30:00Z");
    expect(effectiveStatus({ ...times, status: "DRAFT" }, now)).toBe("DRAFT");
    expect(effectiveStatus({ ...times, status: "CANCELLED" }, now)).toBe(
      "CANCELLED",
    );
  });

  it("früh geöffneter Verkauf bleibt offen", () => {
    const now = at("2026-11-01T12:00:00Z");
    expect(effectiveStatus({ ...times, status: "ON_SALE" }, now)).toBe(
      "ON_SALE",
    );
  });

  it("früh geschlossener Verkauf bleibt geschlossen", () => {
    const now = at("2026-11-03T12:00:00Z");
    expect(effectiveStatus({ ...times, status: "SALE_CLOSED" }, now)).toBe(
      "SALE_CLOSED",
    );
  });

  it("manuell abgeschlossener Drop bleibt abgeschlossen", () => {
    const now = at("2026-11-06T17:00:00Z");
    expect(effectiveStatus({ ...times, status: "COMPLETED" }, now)).toBe(
      "COMPLETED",
    );
  });
});

describe("isGridLocked", () => {
  it("ist bis zum Verkaufsstart offen", () => {
    expect(isGridLocked("DRAFT")).toBe(false);
    expect(isGridLocked("SCHEDULED")).toBe(false);
  });

  it("ist ab Verkaufsstart fix", () => {
    for (const s of [
      "ON_SALE",
      "SALE_CLOSED",
      "LIVE",
      "COMPLETED",
      "CANCELLED",
    ] as const) {
      expect(isGridLocked(s)).toBe(true);
    }
  });
});

describe("dropActions", () => {
  it("Entwurf: veröffentlichen oder absagen", () => {
    expect(dropActions("DRAFT")).toEqual(["publish", "cancel"]);
  });

  it("geplant: zurückziehen, Verkauf öffnen, absagen", () => {
    expect(dropActions("SCHEDULED")).toEqual([
      "unpublish",
      "openSale",
      "cancel",
    ]);
  });

  it("Verkauf offen: schließen oder absagen", () => {
    expect(dropActions("ON_SALE")).toEqual(["closeSale", "cancel"]);
  });

  it("Verkauf geschlossen und laufend: abschließen oder absagen", () => {
    expect(dropActions("SALE_CLOSED")).toEqual(["complete", "cancel"]);
    expect(dropActions("LIVE")).toEqual(["complete", "cancel"]);
  });

  it("Endzustände haben keine Aktionen", () => {
    expect(dropActions("COMPLETED")).toEqual([]);
    expect(dropActions("CANCELLED")).toEqual([]);
  });
});

describe("statusAfter", () => {
  it("bildet jede Aktion auf den gespeicherten Status ab", () => {
    expect(statusAfter("DRAFT", "publish")).toBe("SCHEDULED");
    expect(statusAfter("SCHEDULED", "unpublish")).toBe("DRAFT");
    expect(statusAfter("SCHEDULED", "openSale")).toBe("ON_SALE");
    expect(statusAfter("ON_SALE", "closeSale")).toBe("SALE_CLOSED");
    expect(statusAfter("LIVE", "complete")).toBe("COMPLETED");
    expect(statusAfter("ON_SALE", "cancel")).toBe("CANCELLED");
  });

  it("lehnt unzulässige Übergänge ab", () => {
    expect(statusAfter("DRAFT", "openSale")).toBeNull();
    expect(statusAfter("ON_SALE", "unpublish")).toBeNull();
    expect(statusAfter("COMPLETED", "cancel")).toBeNull();
  });
});

describe("describeGrid", () => {
  it("15–20 Uhr bei 6 min = 50 Slots, erste Abholung 15:06, letzte 20:00", () => {
    const grid = describeGrid({
      bakeStartsAt: at("2026-11-06T14:00:00Z"),
      bakeEndsAt: at("2026-11-06T19:00:00Z"),
      slotSeconds: 360,
      maxPizzasTotal: null,
    });
    expect(grid).toEqual({
      slotCount: 50,
      capacity: 50,
      firstPickupAt: at("2026-11-06T14:06:00Z"),
      lastPickupAt: at("2026-11-06T19:00:00Z"),
      unusedSeconds: 0,
    });
  });

  it("begrenzt die Kapazität durch die Obergrenze", () => {
    const grid = describeGrid({
      bakeStartsAt: at("2026-11-06T14:00:00Z"),
      bakeEndsAt: at("2026-11-06T19:00:00Z"),
      slotSeconds: 360,
      maxPizzasTotal: 40,
    });
    expect(grid?.capacity).toBe(40);
    expect(grid?.slotCount).toBe(50);
  });

  it("meldet den ungenutzten Rest", () => {
    const grid = describeGrid({
      bakeStartsAt: at("2026-11-06T14:00:00Z"),
      bakeEndsAt: at("2026-11-06T15:00:00Z"),
      slotSeconds: 330,
      maxPizzasTotal: null,
    });
    expect(grid?.slotCount).toBe(10);
    expect(grid?.unusedSeconds).toBe(300);
    expect(grid?.lastPickupAt).toEqual(at("2026-11-06T14:55:00Z"));
  });

  it("gibt null zurück, wenn kein Slot entsteht", () => {
    expect(
      describeGrid({
        bakeStartsAt: at("2026-11-06T14:00:00Z"),
        bakeEndsAt: at("2026-11-06T14:03:00Z"),
        slotSeconds: 360,
        maxPizzasTotal: null,
      }),
    ).toBeNull();
    expect(
      describeGrid({
        bakeStartsAt: at("2026-11-06T14:00:00Z"),
        bakeEndsAt: at("2026-11-06T13:00:00Z"),
        slotSeconds: 360,
        maxPizzasTotal: null,
      }),
    ).toBeNull();
  });
});

describe("validateDropTimes", () => {
  const paths = (input: Parameters<typeof validateDropTimes>[0]) =>
    validateDropTimes(input).map((issue) => issue.path);

  it("akzeptiert einen stimmigen Drop", () => {
    expect(
      validateDropTimes({ ...times, slotSeconds: 360, maxPizzasTotal: 30 }),
    ).toEqual([]);
  });

  it("verlangt ein Backende nach dem Backstart", () => {
    expect(
      paths({
        ...times,
        bakeEndsAt: times.bakeStartsAt,
        slotSeconds: 360,
        maxPizzasTotal: null,
      }),
    ).toContain("bakeEndsAt");
  });

  it("verlangt Platz für mindestens eine Pizza", () => {
    expect(
      paths({
        ...times,
        bakeEndsAt: at("2026-11-06T16:04:00Z"),
        slotSeconds: 360,
        maxPizzasTotal: null,
      }),
    ).toContain("bakeEndsAt");
  });

  it("verlangt ein Verkaufsende nach dem Verkaufsstart", () => {
    expect(
      paths({
        ...times,
        saleEndsAt: times.saleStartsAt,
        slotSeconds: 360,
        maxPizzasTotal: null,
      }),
    ).toContain("saleEndsAt");
  });

  it("verlangt einen Verkaufsstart vor dem Backstart", () => {
    expect(
      paths({
        ...times,
        saleStartsAt: times.bakeStartsAt,
        saleEndsAt: times.bakeEndsAt,
        slotSeconds: 360,
        maxPizzasTotal: null,
      }),
    ).toContain("saleStartsAt");
  });

  it("erlaubt kein Verkaufsende nach dem Backende", () => {
    expect(
      paths({
        ...times,
        saleEndsAt: at("2026-11-06T19:30:00Z"),
        slotSeconds: 360,
        maxPizzasTotal: null,
      }),
    ).toContain("saleEndsAt");
  });

  it("erlaubt keine Obergrenze über der Slotanzahl", () => {
    // 17–20 Uhr bei 6 min = 30 Slots
    expect(paths({ ...times, slotSeconds: 360, maxPizzasTotal: 31 })).toContain(
      "maxPizzasTotal",
    );
  });
});

describe("slotStatus", () => {
  const now = at("2026-11-06T12:00:00Z");
  const base = {
    state: "FREE" as const,
    orderId: null,
    reservedUntil: null,
    orderStatus: null,
  };

  it("frei ohne Bestellung", () => {
    expect(slotStatus(base, now)).toBe("free");
  });

  it("gesperrt", () => {
    expect(slotStatus({ ...base, state: "BLOCKED" }, now)).toBe("blocked");
  });

  it("reserviert, solange die Zahlung läuft", () => {
    expect(
      slotStatus(
        {
          ...base,
          orderId: "o1",
          reservedUntil: at("2026-11-06T12:05:00Z"),
          orderStatus: "PENDING_PAYMENT",
        },
        now,
      ),
    ).toBe("reserved");
  });

  it("wieder frei, wenn die Reservierung abgelaufen ist", () => {
    expect(
      slotStatus(
        {
          ...base,
          orderId: "o1",
          reservedUntil: at("2026-11-06T11:55:00Z"),
          orderStatus: "PENDING_PAYMENT",
        },
        now,
      ),
    ).toBe("free");
  });

  it("verkauft bei bezahlter Bestellung", () => {
    for (const orderStatus of [
      "PAID",
      "IN_PROGRESS",
      "READY",
      "PICKED_UP",
      "NO_SHOW",
    ] as const) {
      expect(slotStatus({ ...base, orderId: "o1", orderStatus }, now)).toBe(
        "sold",
      );
    }
  });

  it("frei bei abgelaufener, stornierter oder erstatteter Bestellung", () => {
    for (const orderStatus of ["EXPIRED", "CANCELLED", "REFUNDED"] as const) {
      expect(slotStatus({ ...base, orderId: "o1", orderStatus }, now)).toBe(
        "free",
      );
    }
  });
});

describe("canToggleSlotBlock", () => {
  const now = at("2026-11-06T16:30:00Z");
  const future = at("2026-11-06T17:00:00Z");
  const past = at("2026-11-06T16:00:00Z");

  it("freie und gesperrte Slots in der Zukunft lassen sich umschalten", () => {
    expect(canToggleSlotBlock("free", future, "LIVE", now)).toBe(true);
    expect(canToggleSlotBlock("blocked", future, "ON_SALE", now)).toBe(true);
    expect(canToggleSlotBlock("free", future, "DRAFT", now)).toBe(true);
  });

  it("belegte Slots nicht", () => {
    expect(canToggleSlotBlock("reserved", future, "LIVE", now)).toBe(false);
    expect(canToggleSlotBlock("sold", future, "LIVE", now)).toBe(false);
  });

  it("vergangene Slots nicht", () => {
    expect(canToggleSlotBlock("free", past, "LIVE", now)).toBe(false);
  });

  it("nicht in abgeschlossenen oder abgesagten Drops", () => {
    expect(canToggleSlotBlock("free", future, "COMPLETED", now)).toBe(false);
    expect(canToggleSlotBlock("free", future, "CANCELLED", now)).toBe(false);
  });
});
