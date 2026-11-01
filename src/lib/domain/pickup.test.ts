import { describe, expect, it } from "vitest";
import { findPickupOrders, parseScannedCode, type PickupOrder } from "./pickup";

const at = (minutes: number) => new Date(Date.UTC(2026, 10, 6, 17, minutes));

const order = (
  number: number,
  customer: string,
  pickupCode: string,
  status: PickupOrder["status"],
  pickupMinute: number,
): PickupOrder => ({
  id: `o${number}`,
  number,
  customer,
  pickupCode,
  status,
  pickupAt: at(pickupMinute),
});

const orders = [
  order(501, "Anna Rossi", "VNK8Y6", "READY", 6),
  order(502, "Luca Bianchi", "2Q73T5", "IN_PROGRESS", 18),
  order(503, "Jürgen Müller", "HHM2PA", "PAID", 30),
  order(504, "Annika Schulz", "BX9WQ3", "PICKED_UP", 0),
  order(55, "Maria Verdi", "K7RT2M", "READY", 12),
];

const ids = (query: string) =>
  findPickupOrders(orders, query).map((o) => o.number);

describe("findPickupOrders", () => {
  it("findet über die Bestellnummer, auch mit #", () => {
    expect(ids("502")).toEqual([502]);
    expect(ids("#502")).toEqual([502]);
    expect(ids(" 55 ")).toEqual([55]);
  });

  it("findet über den Abholcode, ohne auf Groß- und Kleinschreibung zu achten", () => {
    expect(ids("vnk8y6")).toEqual([501]);
    expect(ids("HHM2PA")).toEqual([503]);
  });

  it("findet über Teile des Namens, auch ohne Umlaute", () => {
    expect(ids("muller")).toEqual([503]);
    expect(ids("Müll")).toEqual([503]);
    expect(ids("bianchi")).toEqual([502]);
  });

  it("zeigt Abholbereite zuerst, dann nach Abholzeit, Abgeholte zuletzt", () => {
    expect(ids("ann")).toEqual([501, 504]);
    expect(ids("a")).toEqual([]); // zu kurz für die Namenssuche
    expect(findPickupOrders(orders, "r", 10)).toEqual([]);
    expect(
      findPickupOrders(
        [
          order(1, "Rossi A", "AAAAAA", "PICKED_UP", 0),
          order(2, "Rossi B", "BBBBBB", "PAID", 30),
          order(3, "Rossi C", "CCCCCC", "READY", 24),
          order(4, "Rossi D", "DDDDDD", "IN_PROGRESS", 12),
          order(5, "Rossi E", "EEEEEE", "READY", 6),
        ],
        "rossi",
      ).map((o) => o.number),
    ).toEqual([5, 3, 4, 2, 1]);
  });

  it("liefert nichts für leere Eingaben und begrenzt die Treffer", () => {
    expect(ids("")).toEqual([]);
    expect(ids("   ")).toEqual([]);
    expect(ids("#")).toEqual([]);
    const many = Array.from({ length: 12 }, (_, i) =>
      order(600 + i, `Gast ${i}`, `CODE${i}`, "PAID", i),
    );
    expect(findPickupOrders(many, "gast")).toHaveLength(6);
  });
});

describe("parseScannedCode", () => {
  it("nimmt einen gültigen Abholcode aus dem QR-Code", () => {
    expect(parseScannedCode("VNK8Y6")).toBe("VNK8Y6");
    expect(parseScannedCode(" vnk8y6\n")).toBe("VNK8Y6");
  });

  it("verwirft alles, was kein Abholcode ist", () => {
    expect(parseScannedCode("https://example.com")).toBeNull();
    expect(parseScannedCode("VNK8Y")).toBeNull();
    // 0, O, 1, I und L kommen im Alphabet nicht vor
    expect(parseScannedCode("VNK8Y0")).toBeNull();
    expect(parseScannedCode("")).toBeNull();
  });
});
