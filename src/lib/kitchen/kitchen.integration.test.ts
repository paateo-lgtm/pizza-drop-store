import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixtures } from "../../../test/db-fixtures";
import { reserveOrder } from "@/lib/booking/reserve";
import { db } from "@/lib/db";
import { settleCheckout } from "@/lib/payment/settle";
import {
  blockNextSlot,
  finishTicket,
  loadKitchenBoard,
  pickUpOrder,
  startTicket,
} from "./kitchen";

const RUN = `p5k-${Date.now().toString(36)}`;
const f = fixtures(RUN);
let pizza: { id: string };
let customer = 0;

beforeAll(async () => {
  pizza = await f.pizza("Margherita", 1050);
});

afterAll(async () => {
  await f.cleanup();
  await db.$disconnect();
});

/** Reserviert ab `startSeq` und bezahlt sofort; liefert die Bestellung mit Tickets. */
async function paidOrder(dropId: string, startSeq: number, quantity: number) {
  customer += 1;
  const reserved = await reserveOrder({
    dropId,
    startSeq,
    items: [{ pizzaId: pizza.id, quantity }],
    ...f.customer(customer),
  });
  if (!reserved.ok) throw new Error(reserved.message);
  const key = `${RUN}-${customer}`;
  const result = await settleCheckout(
    {
      eventId: key,
      orderId: reserved.orderId,
      sessionId: `cs_${key}`,
      paymentIntentId: `pi_${key}`,
    },
    {
      gateway: {
        refund: async () => {
          throw new Error("keine Erstattung erwartet");
        },
      },
      notify: async () => {},
    },
  );
  if (result !== "accepted") throw new Error(result);
  return tickets(reserved.orderId);
}

async function tickets(orderId: string) {
  const rows = await db.kitchenTicket.findMany({
    where: { orderId },
    orderBy: { seq: "asc" },
  });
  return { orderId, ticketIds: rows.map((t) => t.id) };
}

const orderStatus = async (orderId: string) =>
  (await db.order.findUniqueOrThrow({ where: { id: orderId } })).status;

describe("Kitchen-Mode", () => {
  it("backt eine Bestellung Pizza für Pizza bis zur Abholung", async () => {
    const drop = await f.drop("ablauf", 6, [pizza.id]);
    const { orderId, ticketIds } = await paidOrder(drop.id, 1, 2);
    const [first, second] = ticketIds;

    expect(await startTicket(first)).toEqual({ ok: true });
    expect(await orderStatus(orderId)).toBe("IN_PROGRESS");
    const inOven = await db.kitchenTicket.findUniqueOrThrow({
      where: { id: first },
    });
    expect(inOven.status).toBe("OVEN");
    expect(inOven.ovenStartedAt).not.toBeNull();

    // Ein Ofen, eine Pizza: die zweite muss warten
    expect((await startTicket(second)).ok).toBe(false);
    // Abholen erst, wenn alles fertig ist
    expect((await pickUpOrder(orderId)).ok).toBe(false);

    expect(await finishTicket(first)).toEqual({ ok: true });
    expect(await orderStatus(orderId)).toBe("IN_PROGRESS");

    expect(await startTicket(second)).toEqual({ ok: true });
    expect(await finishTicket(second)).toEqual({ ok: true });
    expect(await orderStatus(orderId)).toBe("READY");

    expect(await pickUpOrder(orderId)).toEqual({ ok: true });
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe("PICKED_UP");
    expect(order.pickedUpAt).not.toBeNull();
    expect((await pickUpOrder(orderId)).ok).toBe(false);
  });

  it("hält die Slot-Reihenfolge ein und lässt „Fertig“ nur für den Ofen zu", async () => {
    const drop = await f.drop("reihenfolge", 6, [pizza.id]);
    const a = await paidOrder(drop.id, 1, 1);
    const b = await paidOrder(drop.id, 2, 1);

    expect((await startTicket(b.ticketIds[0])).ok).toBe(false);
    expect((await finishTicket(a.ticketIds[0])).ok).toBe(false);
    expect((await startTicket("gibt-es-nicht")).ok).toBe(false);
  });

  it("nimmt bei gleichzeitigem Tippen auf zwei Geräten genau einen Ofenstart an", async () => {
    const drop = await f.drop("parallel", 6, [pizza.id]);
    const { ticketIds } = await paidOrder(drop.id, 1, 1);

    const results = await Promise.all(
      Array.from({ length: 5 }, () => startTicket(ticketIds[0])),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it("sperrt als Puffer den nächsten freien Slot", async () => {
    const drop = await f.drop("puffer", 4, [pizza.id]);
    await paidOrder(drop.id, 1, 1);

    expect(await blockNextSlot(drop.id)).toEqual({ ok: true });
    const slots = await db.slot.findMany({
      where: { dropId: drop.id },
      orderBy: { seq: "asc" },
    });
    expect(slots.map((s) => s.state)).toEqual([
      "FREE",
      "BLOCKED",
      "FREE",
      "FREE",
    ]);
  });

  it("meldet, wenn kein freier Slot mehr kommt", async () => {
    const drop = await f.drop("voll", 1, [pizza.id]);
    await paidOrder(drop.id, 1, 1);
    expect((await blockNextSlot(drop.id)).ok).toBe(false);
  });

  it("liefert das Board mit Ofen, nächster Pizza und Abholbereit", async () => {
    const drop = await f.drop("board", 6, [pizza.id]);
    const a = await paidOrder(drop.id, 1, 1);
    const b = await paidOrder(drop.id, 2, 2);
    await startTicket(a.ticketIds[0]);
    await finishTicket(a.ticketIds[0]);
    await startTicket(b.ticketIds[0]);

    const board = await loadKitchenBoard(drop.id);
    if (!board) throw new Error("Board fehlt");
    expect(board.current?.id).toBe(b.ticketIds[0]);
    expect(board.current).toMatchObject({
      pizza: "Margherita",
      position: 1,
      of: 2,
    });
    expect(board.next?.id).toBe(b.ticketIds[1]);
    expect(board.ready.map((o) => o.id)).toEqual([a.orderId]);
    expect(board.slots).toHaveLength(6);
    expect(await loadKitchenBoard("gibt-es-nicht")).toBeNull();
  });
});
