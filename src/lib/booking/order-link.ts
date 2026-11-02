import { createHmac, timingSafeEqual } from "node:crypto";

/** Eigenes Secret, damit ein Wechsel des Session-Secrets keine verschickten Links entwertet. */
const linkSecret = () =>
  process.env.ORDER_LINK_SECRET ?? process.env.SESSION_SECRET;

/** HMAC pro Zweck: Ein Schlüssel für die Bestellseite öffnet nichts anderes. */
function linkKey(
  purpose: "order-link" | "feedback",
  orderId: string,
  secret: string | undefined,
): string {
  if (!secret || secret.length < 32) {
    throw new Error(
      "ORDER_LINK_SECRET (bzw. SESSION_SECRET) fehlt oder ist kürzer als 32 Zeichen",
    );
  }
  return createHmac("sha256", secret)
    .update(`${purpose}:${orderId}`)
    .digest("base64url");
}

function verifyKey(expectedKey: string, key: string | undefined): boolean {
  if (!key) return false;
  const expected = Buffer.from(expectedKey);
  const given = Buffer.from(key);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Bestellseiten sind ohne Login erreichbar. Der Link enthält deshalb neben der ID einen
 * HMAC-Schlüssel; ohne ihn lässt sich eine fremde Bestellung nicht aufrufen.
 */
export function orderKey(orderId: string, secret = linkSecret()): string {
  return linkKey("order-link", orderId, secret);
}

export function verifyOrderKey(
  orderId: string,
  key: string | undefined,
  secret = linkSecret(),
): boolean {
  return verifyKey(orderKey(orderId, secret), key);
}

/** Persönlicher Link in der Feedback-Mail (Bewerten und Widerspruch). */
export function feedbackKey(orderId: string, secret = linkSecret()): string {
  return linkKey("feedback", orderId, secret);
}

export function verifyFeedbackKey(
  orderId: string,
  key: string | undefined,
  secret = linkSecret(),
): boolean {
  return verifyKey(feedbackKey(orderId, secret), key);
}

export const orderPath = (orderId: string) =>
  `/bestellung/${orderId}?k=${orderKey(orderId)}`;

export const feedbackPath = (orderId: string) =>
  `/feedback/${orderId}?k=${feedbackKey(orderId)}`;
