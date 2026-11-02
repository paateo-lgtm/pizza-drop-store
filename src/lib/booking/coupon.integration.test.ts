import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixtures } from "../../../test/db-fixtures";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { priceBreakdown } from "@/lib/domain/booking";
import type { PaymentGateway } from "@/lib/payment/gateway";
import { settleCheckout } from "@/lib/payment/settle";
import { getSettings } from "@/lib/settings";
import { reserveOrder } from "./reserve";

const RUN = `p7c-${Date.now().toString(36)}`;
const PREFIX = RUN.toUpperCase();
const f = fixtures(RUN);

let pizza: { id: string };

beforeAll(async () => {
  pizza = await f.pizza("Margherita", 1050);
});

afterAll(async () => {
  await f.cleanup();
  await db.coupon.deleteMany({ where: { code: { startsWith: PREFIX } } });
  await db.$disconnect();
});

async function coupon(
  suffix: string,
  data: Partial<Prisma.CouponCreateInput> = {},
  dropIds: string[] = [],
) {
  return db.coupon.create({
    data: {
      code: `${PREFIX}-${suffix}`,
      type: "PERCENT",
      value: 10,
      ...data,
      drops: { create: dropIds.map((dropId) => ({ dropId })) },
    },
  });
}

/** Zwei Margherita ab Slot `startSeq` = 21,00 € Zwischensumme */
const input = (
  dropId: string,
  customer: number,
  couponCode: string | undefined,
  startSeq = 1,
) => ({
  ...f.customer(customer),
  dropId,
  startSeq,
  items: [{ pizzaId: pizza.id, quantity: 2 }],
  couponCode,
});

describe("Gutschein bei der Reservierung", () => {
  it("zieht den Rabatt vom Server ab und vermerkt den Gutschein", async () => {
    const drop = await f.drop("prozent", 6, [pizza.id]);
    const c = await coupon("ZEHN");
    const result = await reserveOrder(
      input(drop.id, 1, ` ${c.code.toLowerCase()} `),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const order = await db.order.findUniqueOrThrow({
      where: { id: result.orderId },
    });
    expect(order).toMatchObject({
      subtotalCents: 2100,
      discountCents: 210,
      totalCents: 1890,
      vatCents: priceBreakdown(2100, 210, (await getSettings()).vatRatePercent)
        .vatCents,
      couponId: c.id,
    });
  });

  it("lehnt unbekannte Codes am Feld ab und reserviert nichts", async () => {
    const drop = await f.drop("unbekannt", 6, [pizza.id]);
    const result = await reserveOrder(
      input(drop.id, 2, `${PREFIX}-GIBTSNICHT`),
    );
    expect(result).toMatchObject({
      ok: false,
      conflict: false,
      fieldErrors: {
        couponCode: [expect.stringContaining("kennen wir nicht")],
      },
    });
    expect(await db.order.count({ where: { dropId: drop.id } })).toBe(0);
  });

  it("gilt nur für zugeordnete Drops", async () => {
    const mine = await f.drop("zugeordnet", 6, [pizza.id]);
    const other = await f.drop("anderer", 6, [pizza.id]);
    const c = await coupon("NURDER", {}, [mine.id]);
    expect((await reserveOrder(input(other.id, 3, c.code))).ok).toBe(false);
    expect((await reserveOrder(input(mine.id, 3, c.code))).ok).toBe(true);
  });

  it("vergibt die letzte Einlösung nur einmal, auch über zwei Drops gleichzeitig", async () => {
    const a = await f.drop("parallel-a", 6, [pizza.id]);
    const b = await f.drop("parallel-b", 6, [pizza.id]);
    const c = await coupon("EINMAL", { maxRedemptions: 1 });
    const results = await Promise.all([
      reserveOrder(input(a.id, 4, c.code)),
      reserveOrder(input(b.id, 5, c.code)),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)?.fieldErrors?.couponCode?.[0]).toContain(
      "vollständig eingelöst",
    );
  });

  it("gibt die Einlösung frei, wenn die Reservierung verfällt", async () => {
    const drop = await f.drop("verfallen", 6, [pizza.id]);
    const c = await coupon("FREI", { maxRedemptions: 1 });
    const first = await reserveOrder(input(drop.id, 6, c.code, 1));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect((await reserveOrder(input(drop.id, 7, c.code, 3))).ok).toBe(false);
    await db.order.update({
      where: { id: first.orderId },
      data: { status: "EXPIRED" },
    });
    expect((await reserveOrder(input(drop.id, 7, c.code, 3))).ok).toBe(true);
  });

  it("zählt pro Kunde – eine neue Reservierung ersetzt die eigene alte", async () => {
    const a = await f.drop("kunde-a", 6, [pizza.id]);
    const b = await f.drop("kunde-b", 6, [pizza.id]);
    const c = await coupon("PROKUNDE", { maxPerCustomer: 1 });
    expect((await reserveOrder(input(a.id, 8, c.code, 1))).ok).toBe(true);
    // Gleicher Drop: Die alte Reservierung wird abgelöst, der Gutschein bleibt nutzbar
    expect((await reserveOrder(input(a.id, 8, c.code, 3))).ok).toBe(true);
    const elsewhere = await reserveOrder(input(b.id, 8, c.code, 1));
    expect(elsewhere).toMatchObject({
      ok: false,
      fieldErrors: { couponCode: [expect.stringContaining("schon eingelöst")] },
    });
  });

  it("lehnt Gutscheine ab, die unter den Mindestbetrag führen", async () => {
    const drop = await f.drop("minimum", 6, [pizza.id]);
    const c = await coupon("GRATIS", { type: "FIXED", value: 2100 });
    const result = await reserveOrder(input(drop.id, 9, c.code));
    expect(result).toMatchObject({
      ok: false,
      fieldErrors: { couponCode: [expect.stringContaining("0,50")] },
    });
  });

  it("reserviert ohne Gutschein wie bisher", async () => {
    const drop = await f.drop("ohne", 6, [pizza.id]);
    const result = await reserveOrder(input(drop.id, 10, ""));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      await db.order.findUniqueOrThrow({ where: { id: result.orderId } }),
    ).toMatchObject({ discountCents: 0, totalCents: 2100, couponId: null });
  });
});

describe("Review: Grenzen auch bei Gleichzeitigkeit und später Zahlung", () => {
  it("zählt pro E-Mail, auch wenn eine neue Adresse parallel zweimal bucht", async () => {
    const a = await f.drop("neu-a", 6, [pizza.id]);
    const b = await f.drop("neu-b", 6, [pizza.id]);
    const c = await coupon("NEUKUNDE", { maxPerCustomer: 1 });
    const results = await Promise.all([
      reserveOrder(input(a.id, 13, c.code)),
      reserveOrder(input(b.id, 13, c.code)),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  const gateway = () => {
    const refunds: string[] = [];
    const fake: PaymentGateway = {
      async refund(paymentIntentId, _amount, key) {
        refunds.push(paymentIntentId);
        return { id: `re_${key}` };
      },
    };
    return { refunds, gateway: fake };
  };

  /** Reservierung mit Gutschein, die abläuft, bevor die Zahlung ankommt */
  async function lapsed(dropKey: string, customer: number, code: string) {
    const drop = await f.drop(dropKey, 6, [pizza.id]);
    const result = await reserveOrder(input(drop.id, customer, code));
    if (!result.ok) throw new Error(result.message);
    await db.order.update({
      where: { id: result.orderId },
      data: { status: "EXPIRED", expiresAt: new Date(Date.now() - 60_000) },
    });
    return db.order.findUniqueOrThrow({ where: { id: result.orderId } });
  }

  const pay = (order: { id: string; totalCents: number }, event: string) => ({
    eventId: `${RUN}-${event}`,
    orderId: order.id,
    sessionId: `cs_${RUN}_${event}`,
    paymentIntentId: `pi_${RUN}_${event}`,
    amountTotal: order.totalCents,
    currency: "eur",
  });

  it("erstattet eine späte Zahlung, wenn der Gutschein inzwischen vergeben ist", async () => {
    const c = await coupon("SPAET", { maxRedemptions: 1 });
    const late = await lapsed("spaet-a", 14, c.code);
    const other = await f.drop("spaet-b", 6, [pizza.id]);
    expect((await reserveOrder(input(other.id, 15, c.code))).ok).toBe(true);

    const g = gateway();
    const result = await settleCheckout(pay(late, "spaet"), {
      gateway: g.gateway,
      notify: async () => {},
    });
    expect(result).toBe("refunded");
    expect(g.refunds).toEqual([`pi_${RUN}_spaet`]);
  });

  it("nimmt eine späte Zahlung an, solange der Gutschein noch frei ist", async () => {
    const c = await coupon("NOCHFREI", { maxRedemptions: 1 });
    const late = await lapsed("nochfrei", 16, c.code);
    const g = gateway();
    const result = await settleCheckout(pay(late, "nochfrei"), {
      gateway: g.gateway,
      notify: async () => {},
    });
    expect(result).toBe("accepted");
    expect(g.refunds).toEqual([]);
  });
});
