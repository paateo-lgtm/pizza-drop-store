import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Bestellseiten sind ohne Login erreichbar. Der Link enthält deshalb neben der ID einen
 * HMAC-Schlüssel; ohne ihn lässt sich eine fremde Bestellung nicht aufrufen.
 */
export function orderKey(
  orderId: string,
  secret = process.env.SESSION_SECRET,
): string {
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET fehlt oder ist kürzer als 32 Zeichen");
  }
  return createHmac("sha256", secret)
    .update(`order-link:${orderId}`)
    .digest("base64url");
}

export function verifyOrderKey(
  orderId: string,
  key: string | undefined,
  secret = process.env.SESSION_SECRET,
): boolean {
  if (!key) return false;
  const expected = Buffer.from(orderKey(orderId, secret));
  const given = Buffer.from(key);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export const orderPath = (orderId: string) =>
  `/bestellung/${orderId}?k=${orderKey(orderId)}`;
