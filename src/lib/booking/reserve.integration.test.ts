import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { generateSlots } from "@/lib/domain/slots";
import { reserveOrder } from "./reserve";

const RUN = `p3t-${Date.now().toString(36)}`;
const HOUR = 3_600_000;
const pizzaIds: string[] = [];
const dropIds: string[] = [];

async function createPizza(name: string, priceCents: number) {
  const pizza = await db.pizza.create({
    data: {
      slug: `${RUN}-${name.toLowerCase()}`,
      name,
      description: "Testpizza",
      priceCents,
    },
  });
  pizzaIds.push(pizza.id);
  return pizza;
}

/** Ein Drop im Verkauf, Backbeginn morgen, `slotCount` Slots à 6 min. */
async function createDrop(
  key: string,
  options: {
    slotCount: number;
    pizzas: { id: string; maxQuantity?: number; priceOverrideCents?: number }[];
    maxPizzasTotal?: number;
    maxPizzasPerOrder?: number;
    status?: "ON_SALE" | "DRAFT";
  },
) {
  const now = Date.now();
  const bakeStartsAt = new Date(now + 24 * HOUR);
  const bakeEndsAt = new Date(
    bakeStartsAt.getTime() + options.slotCount * 360_000,
  );
  const drop = await db.drop.create({
    data: {
      slug: `${RUN}-${key}`,
      title: `Test ${key}`,
      status: options.status ?? "ON_SALE",
      saleStartsAt: new Date(now - HOUR),
      saleEndsAt: new Date(now + 23 * HOUR),
      bakeStartsAt,
      bakeEndsAt,
      slotSeconds: 360,
      maxPizzasTotal: options.maxPizzasTotal ?? null,
      maxPizzasPerOrder: options.maxPizzasPerOrder ?? 4,
      pizzas: {
        create: options.pizzas.map((p, i) => ({
          pizzaId: p.id,
          maxQuantity: p.maxQuantity ?? null,
          priceOverrideCents: p.priceOverrideCents ?? null,
          sortOrder: i,
        })),
      },
      slots: {
        create: generateSlots(bakeStartsAt, bakeEndsAt, 360),
      },
    },
  });
  dropIds.push(drop.id);
  return drop;
}

const input = (
  dropId: string,
  i: number,
  startSeq: number,
  items: { pizzaId: string; quantity: number }[],
) => ({
  dropId,
  startSeq,
  items,
  name: `Gast ${i}`,
  email: `${RUN}-${i}@pizzadrop.test`,
  phone: "0171 2345678",
  feedbackConsent: false,
});

let margherita: { id: string };
let diavola: { id: string };

beforeAll(async () => {
  margherita = await createPizza("Margherita", 1050);
  diavola = await createPizza("Diavola", 1250);
});

afterAll(async () => {
  await db.order.deleteMany({ where: { dropId: { in: dropIds } } });
  await db.drop.deleteMany({ where: { id: { in: dropIds } } });
  await db.pizza.deleteMany({ where: { id: { in: pizzaIds } } });
  await db.customer.deleteMany({ where: { email: { startsWith: RUN } } });
  await db.$disconnect();
});

async function occupiedSlots(dropId: string) {
  return db.slot.findMany({
    where: { dropId, orderId: { not: null } },
    orderBy: { seq: "asc" },
    select: { seq: true, orderId: true, reservedUntil: true },
  });
}

describe("reserveOrder", () => {
  it("legt eine Reservierung mit Preisen vom Server und belegten Slots an", async () => {
    const drop = await createDrop("einzeln", {
      slotCount: 10,
      pizzas: [
        { id: margherita.id },
        { id: diavola.id, priceOverrideCents: 1300 },
      ],
    });
    const result = await reserveOrder(
      input(drop.id, 0, 4, [
        { pizzaId: margherita.id, quantity: 1 },
        { pizzaId: diavola.id, quantity: 2 },
      ]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const order = await db.order.findUniqueOrThrow({
      where: { id: result.orderId },
      include: {
        items: true,
        customer: true,
        slots: { orderBy: { seq: "asc" } },
      },
    });
    expect(order).toMatchObject({
      status: "PENDING_PAYMENT",
      subtotalCents: 1050 + 2 * 1300,
      totalCents: 3650,
      vatCents: 239,
      pickupAt: order.slots[2].endsAt,
    });
    expect(order.pickupCode).toMatch(/^[A-Z2-9]{6}$/);
    expect(order.customer.email).toBe(`${RUN}-0@pizzadrop.test`);
    expect(order.slots.map((s) => s.seq)).toEqual([4, 5, 6]);
    expect(
      order.slots.every(
        (s) => s.reservedUntil?.getTime() === order.expiresAt.getTime(),
      ),
    ).toBe(true);
    expect(order.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("vergibt bei 20 gleichzeitigen Checkouts für dieselbe Zeit die Slots genau einmal", async () => {
    const drop = await createDrop("gleichzeitig", {
      slotCount: 10,
      pizzas: [{ id: margherita.id }],
    });
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        reserveOrder(
          input(drop.id, 100 + i, 3, [{ pizzaId: margherita.id, quantity: 2 }]),
        ),
      ),
    );
    const won = results.filter((r) => r.ok);
    expect(won).toHaveLength(1);
    expect(results.filter((r) => !r.ok).every((r) => !r.ok && r.conflict)).toBe(
      true,
    );

    const slots = await occupiedSlots(drop.id);
    expect(slots.map((s) => s.seq)).toEqual([3, 4]);
    expect(new Set(slots.map((s) => s.orderId))).toEqual(
      new Set([won[0].ok ? won[0].orderId : ""]),
    );
    expect(await db.order.count({ where: { dropId: drop.id } })).toBe(1);
  });

  it("hält bei 20 gleichzeitigen Checkouts die Obergrenze des Drops ein", async () => {
    const drop = await createDrop("obergrenze", {
      slotCount: 30,
      maxPizzasTotal: 10,
      pizzas: [{ id: margherita.id }],
    });
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        reserveOrder(
          input(drop.id, 200 + i, i + 1, [
            { pizzaId: margherita.id, quantity: 1 },
          ]),
        ),
      ),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(10);
    const slots = await occupiedSlots(drop.id);
    expect(slots).toHaveLength(10);
    expect(new Set(slots.map((s) => s.orderId)).size).toBe(10);
  });

  it("hält das Kontingent einer Sorte auch bei parallelen Checkouts ein", async () => {
    const drop = await createDrop("kontingent", {
      slotCount: 10,
      pizzas: [{ id: diavola.id, maxQuantity: 3 }],
    });
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        reserveOrder(
          input(drop.id, 300 + i, i + 1, [
            { pizzaId: diavola.id, quantity: 1 },
          ]),
        ),
      ),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(3);
    expect(results.filter((r) => !r.ok)).toEqual(
      Array(3).fill(
        expect.objectContaining({ message: "Diavola ist ausverkauft." }),
      ),
    );
  });

  it("gibt Slots einer abgelaufenen Reservierung wieder frei", async () => {
    const drop = await createDrop("ablauf", {
      slotCount: 5,
      pizzas: [{ id: margherita.id }],
    });
    const first = await reserveOrder(
      input(drop.id, 400, 1, [{ pizzaId: margherita.id, quantity: 2 }]),
      new Date(Date.now() - 30 * 60_000),
    );
    expect(first.ok).toBe(true);
    const second = await reserveOrder(
      input(drop.id, 401, 1, [{ pizzaId: margherita.id, quantity: 2 }]),
    );
    expect(second.ok).toBe(true);
    const slots = await occupiedSlots(drop.id);
    expect(slots.map((s) => s.orderId)).toEqual(
      Array(2).fill(second.ok ? second.orderId : ""),
    );
  });

  it("lehnt Drops außerhalb des Verkaufs ab", async () => {
    const drop = await createDrop("entwurf", {
      slotCount: 5,
      status: "DRAFT",
      pizzas: [{ id: margherita.id }],
    });
    const result = await reserveOrder(
      input(drop.id, 500, 1, [{ pizzaId: margherita.id, quantity: 1 }]),
    );
    expect(result).toMatchObject({ ok: false, conflict: false });
    expect(await db.order.count({ where: { dropId: drop.id } })).toBe(0);
  });

  it("überschreibt fremde Kundendaten nicht und speichert den Kontakt an der Bestellung", async () => {
    const drop = await createDrop("kontakt", {
      slotCount: 5,
      pizzas: [{ id: margherita.id }],
    });
    const first = await reserveOrder(
      input(drop.id, 600, 1, [{ pizzaId: margherita.id, quantity: 1 }]),
    );
    // Jemand anderes bestellt mit derselben E-Mail, aber eigenem Namen und Telefon
    const second = await reserveOrder({
      ...input(drop.id, 600, 3, [{ pizzaId: margherita.id, quantity: 1 }]),
      name: "Fremder",
      phone: "0999 999999",
    });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    const customer = await db.customer.findUniqueOrThrow({
      where: { email: `${RUN}-600@pizzadrop.test` },
    });
    expect(customer).toMatchObject({ name: "Gast 600", phone: "0171 2345678" });
    const order = await db.order.findUniqueOrThrow({
      where: { id: second.orderId },
    });
    expect(order).toMatchObject({
      customerId: customer.id,
      customerName: "Fremder",
      customerPhone: "0999 999999",
    });
  });

  it("gibt die offene Reservierung derselben E-Mail frei, wenn sie neu bucht", async () => {
    const drop = await createDrop("neu-buchen", {
      slotCount: 6,
      pizzas: [{ id: margherita.id }],
    });
    const first = await reserveOrder(
      input(drop.id, 700, 1, [{ pizzaId: margherita.id, quantity: 2 }]),
    );
    const second = await reserveOrder(
      input(drop.id, 700, 4, [{ pizzaId: margherita.id, quantity: 1 }]),
    );
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    const slots = await occupiedSlots(drop.id);
    expect(slots.map((s) => [s.seq, s.orderId])).toEqual([[4, second.orderId]]);
    const old = await db.order.findUniqueOrThrow({
      where: { id: first.orderId },
    });
    expect(old.status).toBe("EXPIRED");
  });

  it("lehnt ungültige Checkout-Daten mit Feldfehlern ab", async () => {
    const result = await reserveOrder({ dropId: "x", startSeq: 1, items: [] });
    expect(result).toMatchObject({
      ok: false,
      fieldErrors: expect.objectContaining({ email: expect.any(Array) }),
    });
  });
});
