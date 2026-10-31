/**
 * Signiertes Session-Token (JWT, HS256). Ohne Abhängigkeit zu next/headers,
 * damit Proxy, Server und Tests es gleichermaßen nutzen können.
 */
import { jwtVerify, SignJWT } from "jose";
import type { Role } from "./permissions";

export const SESSION_COOKIE = "pd_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12; // eine lange Schicht

export type SessionPayload = {
  userId: string;
  role: Role;
  /** Muss zu User.sessionVersion passen, sonst ist die Sitzung beendet. */
  version: number;
};

function key(secret: string | undefined = process.env.SESSION_SECRET) {
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET fehlt oder ist kürzer als 32 Zeichen");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(
  payload: SessionPayload,
  secret?: string,
): Promise<string> {
  return new SignJWT({ role: payload.role, sv: payload.version })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(key(secret));
}

/**
 * Liefert null bei fehlendem, abgelaufenem oder manipuliertem Token.
 * Ein fehlendes Secret ist ein Konfigurationsfehler und wird nicht verschluckt.
 */
export async function verifySession(
  token: string | undefined,
  secret?: string,
): Promise<SessionPayload | null> {
  if (!token) return null;
  const secretKey = key(secret);
  try {
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
    });
    const { role, sv } = payload;
    if (
      !payload.sub ||
      (role !== "ADMIN" && role !== "KITCHEN") ||
      typeof sv !== "number"
    ) {
      return null;
    }
    return { userId: payload.sub, role, version: sv };
  } catch {
    return null;
  }
}
