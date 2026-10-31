import { describe, expect, it } from "vitest";
import { PERMISSIONS, can, homePathFor } from "./permissions";

describe("can", () => {
  it("erlaubt Admins alles", () => {
    for (const permission of PERMISSIONS) {
      expect(can("ADMIN", permission)).toBe(true);
    }
  });

  it("beschränkt die Küche auf Küche und Bestellungen", () => {
    expect(can("KITCHEN", "kitchen:use")).toBe(true);
    expect(can("KITCHEN", "orders:view")).toBe(true);
    expect(can("KITCHEN", "pizzas:manage")).toBe(false);
    expect(can("KITCHEN", "settings:manage")).toBe(false);
    expect(can("KITCHEN", "team:manage")).toBe(false);
    expect(can("KITCHEN", "reports:view")).toBe(false);
  });
});

describe("homePathFor", () => {
  it("leitet je Rolle auf die passende Startseite", () => {
    expect(homePathFor("ADMIN")).toBe("/admin");
    expect(homePathFor("KITCHEN")).toBe("/kitchen");
  });
});
