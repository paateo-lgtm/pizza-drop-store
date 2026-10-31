import { describe, expect, it } from "vitest";
import { orderKey, verifyOrderKey } from "./order-link";

const secret = "test-secret-mit-mindestens-32-zeichen-laenge";

describe("Bestell-Link", () => {
  it("bestätigt den Schlüssel der eigenen Bestellung", () => {
    const key = orderKey("order1", secret);
    expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(verifyOrderKey("order1", key, secret)).toBe(true);
  });

  it("lehnt fremde, manipulierte und fehlende Schlüssel ab", () => {
    const key = orderKey("order1", secret);
    expect(verifyOrderKey("order2", key, secret)).toBe(false);
    const tampered = key.slice(0, -1) + (key.endsWith("A") ? "B" : "A");
    expect(verifyOrderKey("order1", tampered, secret)).toBe(false);
    expect(verifyOrderKey("order1", "kurz", secret)).toBe(false);
    expect(verifyOrderKey("order1", undefined, secret)).toBe(false);
    expect(
      verifyOrderKey("order1", key, "anderes-secret-mit-32-zeichen-laenge!"),
    ).toBe(false);
  });

  it("verlangt ein ausreichend langes Secret", () => {
    expect(() => orderKey("order1", "zu-kurz")).toThrow();
  });
});
