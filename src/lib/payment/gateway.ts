import "server-only";
import { getStripe } from "./stripe";

/** Was Zahlungseingang und Storno vom Zahlungsanbieter brauchen; in Tests eine Attrappe. */
export type PaymentGateway = {
  /** Erstattet den Betrag; derselbe Schlüssel führt nie zu einer zweiten Erstattung. */
  refund(
    paymentIntentId: string,
    amountCents: number,
    idempotencyKey: string,
  ): Promise<{ id: string }>;
};

export const stripeGateway: PaymentGateway = {
  async refund(paymentIntentId, amountCents, idempotencyKey) {
    const refund = await getStripe().refunds.create(
      { payment_intent: paymentIntentId, amount: amountCents },
      { idempotencyKey },
    );
    return { id: refund.id };
  },
};
