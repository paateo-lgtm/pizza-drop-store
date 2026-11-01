import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixtures } from "../../../test/db-fixtures";
import { reserveOrder } from "@/lib/booking/reserve";
import { db } from "@/lib/db";
import { cancelOrder } from "./cancel";
import type { PaymentGateway } from "./gateway";
import type { OrderNotice } from "./notify";
import { settleCheckout } from "./settle";

const RUN = `p4t-${Date.now().toString(36)}`;
const f = fixtures(RUN);
let pizza: { id: string };

/** Zahlungsanbieter-Attrappe: merkt sich Erstattungen, kann auf Wunsch scheitern. */
function fakeGateway(options: { failRefund?: boolean } = {}) {
  const refunds: {
    paymentIntentId: string;
    amountCents: number;
    key: string;
  }[] = [];
  const gateway: PaymentGateway = {
    async refund(paymentIntentId, amountCents, idempotencyKey) {
      if (options.failRefund) throw new Error("Stripe nicht erreichbar");
      refunds.push({ paymentIntentId, amountCents, key: idempotencyKey });
      return { id: `re_${idempotencyKey}` };
    },
  };
  return { gateway, refunds };
}

function notices() {
  const sent: OrderNotice[] = [];
  return { sent, notify: async (n: OrderNotice) => void sent.push(n) };
}

async function reserved(
  dropId: string,
  i: number,
  startSeq: number,
  quantity: number,
) {
  const result = await reserveOrder({
    dropId,
    startSeq,
    items: [{ pizzaId: pizza.id, quantity }],
    ...f.customer(i),
  });
  if (!result.ok) throw new Error(result.message);
  return result.orderId;
}

const paid = (
  orderId: string,
  event: string,
  paymentIntentId = `pi_${event}`,
) => ({
  eventId: `${RUN}-${event}`,
  orderId,
  sessionId: `cs_${event}`,
  paymentIntentId,
});

beforeAll(async () => {
  pizza = await f.pizza("Margherita", 1050);
});

afterAll(async () => {
  await f.cleanup();
  await db.$disconnect();
});

describe("settleCheckout", () => {
  it("nimmt die Zahlung an, legt Tickets in Slot-Reihenfolge an und benachrichtigt einmal", async () => {
    const drop = await f.drop("annehmen", 6, [pizza.id]);
    const orderId = await reserved(drop.id, 1, 3, 2);
    const { gateway, refunds } = fakeGateway();
    const mail = notices();

    const result = await settleCheckout(paid(orderId, "a1"), {
      gateway,
      notify: mail.notify,
    });
    expect(result).toBe("accepted");

    const order = await db.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        tickets: { orderBy: { seq: "asc" } },
        slots: { orderBy: { seq: "asc" } },
        customer: true,
      },
    });
    expect(order).toMatchObject({
      status: "PAID",
      stripeSessionId: "cs_a1",
      stripePaymentIntentId: "pi_a1",
    });
    expect(order.paidAt).toBeInstanceOf(Date);
    expect(order.tickets.map((t) => [t.seq, t.pizzaId, t.status])).toEqual([
      [3, pizza.id, "QUEUED"],
      [4, pizza.id, "QUEUED"],
    ]);
    expect(order.slots.every((s) => s.reservedUntil === null)).toBe(true);
    expect(order.customer.firstOrderAt).toBeInstanceOf(Date);
    expect(refunds).toEqual([]);
    expect(mail.sent).toEqual([{ kind: "confirmed", orderId }]);
  });

  it("verarbeitet dasselbe Event nur einmal, auch bei paralleler Zustellung", async () => {
    const drop = await f.drop("doppelt", 4, [pizza.id]);
    const orderId = await reserved(drop.id, 2, 1, 1);
    const { gateway } = fakeGateway();
    const mail = notices();

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        settleCheckout(paid(orderId, "d1"), { gateway, notify: mail.notify }),
      ),
    );
    expect(results.filter((r) => r === "accepted")).toHaveLength(1);
    expect(results.filter((r) => r === "duplicate")).toHaveLength(4);
    // Ein zweites Event zur selben Zahlung (z. B. async_payment_succeeded) ändert nichts
    expect(
      await settleCheckout(paid(orderId, "d2", "pi_d1"), {
        gateway,
        notify: mail.notify,
      }),
    ).toBe("duplicate");
    expect(await db.kitchenTicket.count({ where: { orderId } })).toBe(1);
    expect(mail.sent).toHaveLength(1);
  });

  it("erstattet eine verspätete Zahlung, wenn die Slots schon neu vergeben sind", async () => {
    const drop = await f.drop("spaet", 4, [pizza.id]);
    // Reservierung vor 30 min: abgelaufen
    const late = await reserveOrder(
      {
        dropId: drop.id,
        startSeq: 1,
        items: [{ pizzaId: pizza.id, quantity: 2 }],
        ...f.customer(3),
      },
      new Date(Date.now() - 30 * 60_000),
    );
    if (!late.ok) throw new Error(late.message);
    const other = await reserved(drop.id, 4, 1, 2);
    const { gateway, refunds } = fakeGateway();
    const mail = notices();

    const result = await settleCheckout(paid(late.orderId, "l1", "pi_late"), {
      gateway,
      notify: mail.notify,
    });
    expect(result).toBe("refunded");
    expect(refunds).toEqual([
      {
        paymentIntentId: "pi_late",
        amountCents: 2100,
        key: "late:pi_late",
      },
    ]);
    const order = await db.order.findUniqueOrThrow({
      where: { id: late.orderId },
      include: { refunds: true, tickets: true },
    });
    expect(order.status).toBe("REFUNDED");
    expect(order.tickets).toEqual([]);
    expect(order.refunds.map((r) => r.amountCents)).toEqual([2100]);
    // Die Slots gehören weiter der neuen Bestellung
    expect(
      await db.slot.count({ where: { dropId: drop.id, orderId: other } }),
    ).toBe(2);
    expect(mail.sent).toEqual([{ kind: "refunded", orderId: late.orderId }]);
  });

  it("nimmt eine verspätete Zahlung an, solange niemand die Slots übernommen hat", async () => {
    const drop = await f.drop("spaet-frei", 4, [pizza.id]);
    const late = await reserveOrder(
      {
        dropId: drop.id,
        startSeq: 2,
        items: [{ pizzaId: pizza.id, quantity: 1 }],
        ...f.customer(5),
      },
      new Date(Date.now() - 30 * 60_000),
    );
    if (!late.ok) throw new Error(late.message);
    const { gateway } = fakeGateway();
    expect(
      await settleCheckout(paid(late.orderId, "l2"), {
        gateway,
        notify: notices().notify,
      }),
    ).toBe("accepted");
  });

  it("erstattet eine zweite Zahlung derselben Bestellung (zwei offene Zahlfenster)", async () => {
    const drop = await f.drop("zweimal", 4, [pizza.id]);
    const orderId = await reserved(drop.id, 11, 1, 1);
    const { gateway, refunds } = fakeGateway();
    const mail = notices();
    await settleCheckout(paid(orderId, "z1", "pi_erste"), {
      gateway,
      notify: mail.notify,
    });
    expect(
      await settleCheckout(paid(orderId, "z2", "pi_zweite"), {
        gateway,
        notify: mail.notify,
      }),
    ).toBe("duplicatePaymentRefunded");
    expect(refunds).toEqual([
      { paymentIntentId: "pi_zweite", amountCents: 1050, key: "dup:pi_zweite" },
    ]);
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order).toMatchObject({
      status: "PAID",
      stripePaymentIntentId: "pi_erste",
    });
    expect(mail.sent).toEqual([{ kind: "confirmed", orderId }]);
  });

  it("lässt Stripe erneut zustellen, wenn die Erstattung scheitert", async () => {
    const drop = await f.drop("erstattung-fehler", 4, [pizza.id]);
    const orderId = await reserved(drop.id, 6, 1, 1);
    await db.order.update({
      where: { id: orderId },
      data: { status: "CANCELLED" },
    });

    const failing = fakeGateway({ failRefund: true });
    await expect(
      settleCheckout(paid(orderId, "f1"), {
        gateway: failing.gateway,
        notify: notices().notify,
      }),
    ).rejects.toThrow("Stripe nicht erreichbar");
    expect(
      await db.processedWebhookEvent.count({ where: { id: `${RUN}-f1` } }),
    ).toBe(0);

    const working = fakeGateway();
    expect(
      await settleCheckout(paid(orderId, "f1"), {
        gateway: working.gateway,
        notify: notices().notify,
      }),
    ).toBe("refunded");
    expect(working.refunds).toHaveLength(1);
  });
});

describe("cancelOrder", () => {
  it("erstattet eine bezahlte Bestellung, löscht Tickets und gibt die Slots frei", async () => {
    const drop = await f.drop("storno", 4, [pizza.id]);
    const orderId = await reserved(drop.id, 7, 2, 2);
    await settleCheckout(paid(orderId, "c1", "pi_c1"), {
      gateway: fakeGateway().gateway,
      notify: notices().notify,
    });
    const { gateway, refunds } = fakeGateway();
    const mail = notices();

    const result = await cancelOrder(orderId, "Ofen defekt", {
      gateway,
      notify: mail.notify,
    });
    expect(result).toEqual({ ok: true, status: "REFUNDED" });
    expect(refunds).toEqual([
      { paymentIntentId: "pi_c1", amountCents: 2100, key: `cancel:${orderId}` },
    ]);
    const order = await db.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { tickets: true, slots: true, refunds: true },
    });
    expect(order.status).toBe("REFUNDED");
    expect(order.tickets).toEqual([]);
    expect(order.slots).toEqual([]);
    expect(order.refunds[0]).toMatchObject({
      amountCents: 2100,
      reason: "Ofen defekt",
    });
    expect(mail.sent).toEqual([{ kind: "cancelled", orderId }]);
  });

  it("storniert eine offene Reservierung ohne Erstattung", async () => {
    const drop = await f.drop("storno-offen", 4, [pizza.id]);
    const orderId = await reserved(drop.id, 8, 1, 1);
    const { gateway, refunds } = fakeGateway();
    expect(
      await cancelOrder(orderId, null, { gateway, notify: notices().notify }),
    ).toEqual({ ok: true, status: "CANCELLED" });
    expect(refunds).toEqual([]);
    expect(await db.slot.count({ where: { orderId } })).toBe(0);
  });

  it("lässt die Bestellung unverändert, wenn die Erstattung scheitert", async () => {
    const drop = await f.drop("storno-fehler", 4, [pizza.id]);
    const orderId = await reserved(drop.id, 9, 1, 1);
    await settleCheckout(paid(orderId, "c2"), {
      gateway: fakeGateway().gateway,
      notify: notices().notify,
    });
    const result = await cancelOrder(orderId, null, {
      gateway: fakeGateway({ failRefund: true }).gateway,
      notify: notices().notify,
    });
    expect(result).toMatchObject({ ok: false });
    const order = await db.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { tickets: true },
    });
    expect(order.status).toBe("PAID");
    expect(order.tickets).toHaveLength(1);
  });

  it("lehnt abgeschlossene Bestellungen ab", async () => {
    const drop = await f.drop("storno-abgeholt", 4, [pizza.id]);
    const orderId = await reserved(drop.id, 10, 1, 1);
    await db.order.update({
      where: { id: orderId },
      data: { status: "PICKED_UP" },
    });
    expect(
      await cancelOrder(orderId, null, {
        gateway: fakeGateway().gateway,
        notify: notices().notify,
      }),
    ).toMatchObject({ ok: false });
  });
});
