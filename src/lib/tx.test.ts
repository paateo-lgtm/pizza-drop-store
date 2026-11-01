import { describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { isBusyError } from "./tx";

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError("Testfehler", {
    code,
    clientVersion: "test",
  });

describe("isBusyError", () => {
  it("wertet Timeouts und Sperrkonflikte als „gerade belegt“", () => {
    // P2024: keine Verbindung frei, P2028: Transaktion zu lang, P2034: Schreibkonflikt
    for (const code of ["P2024", "P2028", "P2034"]) {
      expect(isBusyError(prismaError(code))).toBe(true);
    }
  });

  it("wertet echte Fehler nicht als „belegt“", () => {
    expect(isBusyError(prismaError("P2002"))).toBe(false);
    expect(isBusyError(prismaError("P2025"))).toBe(false);
    expect(isBusyError(new Error("kaputt"))).toBe(false);
    expect(isBusyError(null)).toBe(false);
  });
});
