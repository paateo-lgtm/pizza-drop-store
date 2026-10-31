import { describe, expect, it } from "vitest";
import { teamChangeError } from "./team-rules";

const team = [
  { id: "a1", role: "ADMIN" as const, active: true },
  { id: "a2", role: "ADMIN" as const, active: true },
  { id: "k1", role: "KITCHEN" as const, active: true },
];

describe("teamChangeError", () => {
  it("erlaubt normale Änderungen", () => {
    expect(
      teamChangeError(team, "a1", { targetId: "k1", active: false }),
    ).toBeNull();
    expect(
      teamChangeError(team, "a1", { targetId: "a2", role: "KITCHEN" }),
    ).toBeNull();
    expect(
      teamChangeError(team, "a1", { targetId: "k1", role: "ADMIN" }),
    ).toBeNull();
  });

  it("verhindert, dass man sich selbst aussperrt", () => {
    expect(
      teamChangeError(team, "a1", { targetId: "a1", active: false }),
    ).toMatch(/selbst/);
    expect(
      teamChangeError(team, "a1", { targetId: "a1", role: "KITCHEN" }),
    ).toMatch(/eigene Rolle/);
  });

  it("hält mindestens einen aktiven Admin", () => {
    const oneAdmin = [team[0], { ...team[1], active: false }, team[2]];
    expect(
      teamChangeError(oneAdmin, "k1", { targetId: "a1", active: false }),
    ).toMatch(/mindestens ein aktiver Admin/);
    expect(
      teamChangeError(oneAdmin, "k1", { targetId: "a1", role: "KITCHEN" }),
    ).toMatch(/mindestens ein aktiver Admin/);
  });

  it("meldet unbekannte Zugänge", () => {
    expect(teamChangeError(team, "a1", { targetId: "x" })).toMatch(
      /nicht mehr/,
    );
  });
});
