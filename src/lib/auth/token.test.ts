import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { signSession, verifySession } from "./token";

const secret = "test-secret-mit-mindestens-32-zeichen-laenge";
const sign = (claims: Record<string, unknown>, exp: string | number = "1h") =>
  new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("u1")
    .setExpirationTime(exp)
    .sign(new TextEncoder().encode(secret));

describe("Session-Token", () => {
  it("überträgt Nutzer, Rolle und Sitzungsversion", async () => {
    const token = await signSession(
      { userId: "u1", role: "KITCHEN", version: 3 },
      secret,
    );
    await expect(verifySession(token, secret)).resolves.toEqual({
      userId: "u1",
      role: "KITCHEN",
      version: 3,
    });
  });

  it("lehnt fehlende und manipulierte Tokens ab", async () => {
    await expect(verifySession(undefined, secret)).resolves.toBeNull();
    const token = await signSession(
      { userId: "u1", role: "ADMIN", version: 0 },
      secret,
    );
    await expect(
      verifySession(token, "ein-anderes-secret-mit-32-zeichen-oder-mehr"),
    ).resolves.toBeNull();
    await expect(verifySession(`${token}x`, secret)).resolves.toBeNull();
  });

  it("lehnt abgelaufene Tokens ab", async () => {
    const expired = await sign(
      { role: "ADMIN", sv: 0 },
      Math.floor(Date.now() / 1000) - 10,
    );
    await expect(verifySession(expired, secret)).resolves.toBeNull();
  });

  it("lehnt unbekannte Rollen und Tokens ohne Version ab", async () => {
    await expect(
      verifySession(await sign({ role: "SUPERUSER", sv: 0 }), secret),
    ).resolves.toBeNull();
    await expect(
      verifySession(await sign({ role: "ADMIN" }), secret),
    ).resolves.toBeNull();
  });

  it("verlangt ein ausreichend langes Secret", async () => {
    await expect(
      signSession({ userId: "u1", role: "ADMIN", version: 0 }, "kurz"),
    ).rejects.toThrow("SESSION_SECRET");
    await expect(verifySession("x", "kurz")).rejects.toThrow("SESSION_SECRET");
  });
});
