import { describe, expect, it } from "vitest";
import { isCronAuthorized } from "./cron";

const SECRET = "x".repeat(40);

describe("isCronAuthorized", () => {
  it("lässt nur den richtigen Bearer-Schlüssel zu", () => {
    expect(isCronAuthorized(`Bearer ${SECRET}`, SECRET)).toBe(true);
    expect(isCronAuthorized(`Bearer ${SECRET}y`, SECRET)).toBe(false);
    expect(isCronAuthorized(SECRET, SECRET)).toBe(false);
    expect(isCronAuthorized(null, SECRET)).toBe(false);
  });

  it("sperrt alles, solange kein ausreichend langer Schlüssel gesetzt ist", () => {
    expect(isCronAuthorized("Bearer ", "")).toBe(false);
    expect(isCronAuthorized("Bearer kurz", "kurz")).toBe(false);
    expect(isCronAuthorized("Bearer x", undefined)).toBe(false);
  });
});
