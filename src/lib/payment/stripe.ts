import "server-only";
import Stripe from "stripe";

let client: Stripe | null = null;

export const isStripeConfigured = () => !!process.env.STRIPE_SECRET_KEY;

/** Stripe-Client, erst beim ersten Gebrauch erzeugt, damit Build und Tests ohne Schlüssel laufen. */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY ist nicht gesetzt");
  client ??= new Stripe(key, { maxNetworkRetries: 2 });
  return client;
}
