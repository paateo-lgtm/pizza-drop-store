import Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { readCheckoutEvent } from "./webhook";

const secret = "whsec_test_geheim";
const signer = new Stripe("sk_test_signatur").webhooks;

function signed(event: object, key = secret) {
  const payload = JSON.stringify(event);
  return {
    payload,
    signature: signer.generateTestHeaderString({ payload, secret: key }),
  };
}

const session = (overrides: Record<string, unknown> = {}) => ({
  id: "evt_1",
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_1",
      object: "checkout.session",
      payment_status: "paid",
      payment_intent: "pi_1",
      metadata: { orderId: "order1" },
      client_reference_id: "order1",
      ...overrides,
    },
  },
});

describe("readCheckoutEvent", () => {
  it("liest eine bezahlte Checkout-Session", () => {
    const { payload, signature } = signed(session());
    expect(readCheckoutEvent(payload, signature, secret)).toEqual({
      kind: "paid",
      input: {
        eventId: "evt_1",
        orderId: "order1",
        sessionId: "cs_1",
        paymentIntentId: "pi_1",
      },
    });
  });

  it("wartet bei verzögerten Zahlarten auf die Bestätigung", () => {
    const pending = signed(session({ payment_status: "unpaid" }));
    expect(
      readCheckoutEvent(pending.payload, pending.signature, secret),
    ).toEqual({
      kind: "ignored",
    });
    const later = signed({
      ...session(),
      type: "checkout.session.async_payment_succeeded",
    });
    expect(
      readCheckoutEvent(later.payload, later.signature, secret),
    ).toMatchObject({
      kind: "paid",
    });
  });

  it("ignoriert andere Events und Sessions ohne Bestellung", () => {
    const other = signed({ ...session(), type: "checkout.session.expired" });
    expect(readCheckoutEvent(other.payload, other.signature, secret)).toEqual({
      kind: "ignored",
    });
    const foreign = signed(
      session({ metadata: {}, client_reference_id: null }),
    );
    expect(
      readCheckoutEvent(foreign.payload, foreign.signature, secret),
    ).toEqual({
      kind: "ignored",
    });
  });

  it("lehnt falsche oder fehlende Signaturen ab", () => {
    const { payload } = signed(session());
    const forged = signed(session(), "whsec_falsch").signature;
    expect(readCheckoutEvent(payload, forged, secret)).toEqual({
      kind: "invalid",
    });
    expect(readCheckoutEvent(payload, null, secret)).toEqual({
      kind: "invalid",
    });
    // Manipulierter Inhalt mit alter Signatur
    const { signature } = signed(session());
    expect(
      readCheckoutEvent(payload.replace("order1", "order2"), signature, secret),
    ).toEqual({ kind: "invalid" });
  });
});
