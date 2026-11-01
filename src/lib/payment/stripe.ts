import "server-only";
import Stripe from "stripe";

let client: Stripe | null = null;

/**
 * Zahlung nur anbieten, wenn auch der Webhook prüfen kann: Sonst würde kassiert, aber
 * nie bestätigt.
 */
export const isStripeConfigured = () =>
  !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET;

/** Stripe-Client, erst beim ersten Gebrauch erzeugt, damit Build und Tests ohne Schlüssel laufen. */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY ist nicht gesetzt");
  // Kurzes Timeout: Erstattungen laufen unter der Drop-Sperre (siehe settle.ts, cancel.ts).
  client ??= new Stripe(key, { maxNetworkRetries: 1, timeout: 8_000 });
  return client;
}
