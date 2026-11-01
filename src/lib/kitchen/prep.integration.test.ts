import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixtures } from "../../../test/db-fixtures";
import { reserveOrder } from "@/lib/booking/reserve";
import { db } from "@/lib/db";
import { settleCheckout } from "@/lib/payment/settle";
import { loadPrepList } from "./prep";

const RUN = `p6p-${Date.now().toString(36)}`;
const f = fixtures(RUN);
let margherita: { id: string };
let marinara: { id: string };
const ingredientIds: string[] = [];
let customer = 0;

beforeAll(async () => {
  margherita = await f.pizza("Margherita", 1050);
  marinara = await f.pizza("Marinara", 850);
  const tomato = await db.ingredient.create({
    data: { name: `${RUN} Tomaten`, unit: "GRAM" },
  });
  const cheese = await db.ingredient.create({
    data: { name: `${RUN} Fior di Latte`, unit: "GRAM" },
  });
  ingredientIds.push(tomato.id, cheese.id);
  await db.pizzaIngredient.createMany({
    data: [
      { pizzaId: margherita.id, ingredientId: tomato.id, amountPerPizza: 80 },
      { pizzaId: margherita.id, ingredientId: cheese.id, amountPerPizza: 100 },
      { pizzaId: marinara.id, ingredientId: tomato.id, amountPerPizza: 100.5 },
    ],
  });
});

afterAll(async () => {
  await f.cleanup();
  await db.ingredient.deleteMany({ where: { id: { in: ingredientIds } } });
  await db.$disconnect();
});

async function paid(
  dropId: string,
  startSeq: number,
  items: { pizzaId: string; quantity: number }[],
) {
  customer += 1;
  const reserved = await reserveOrder({
    dropId,
    startSeq,
    items,
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
}

describe("loadPrepList", () => {
  it("rechnet verkauft, Ausverkauf nach früheren Drops und Puffer aus der Datenbank", async () => {
    // Früherer Drop: 3 Margherita, 1 Marinara → Verteilung 3 : 1
    const earlier = await f.drop("frueher", 6, [margherita.id, marinara.id]);
    await paid(earlier.id, 1, [
      { pizzaId: margherita.id, quantity: 3 },
      { pizzaId: marinara.id, quantity: 1 },
    ]);
    await db.drop.update({
      where: { id: earlier.id },
      data: {
        bakeStartsAt: new Date(Date.now() - 48 * 3_600_000),
        bakeEndsAt: new Date(Date.now() - 47 * 3_600_000),
      },
    });

    // Aktueller Drop: 10 Slots, einer gesperrt → Kapazität 9; verkauft 1 Margherita
    const drop = await f.drop("aktuell", 10, [margherita.id, marinara.id]);
    await db.slot.update({
      where: { dropId_seq: { dropId: drop.id, seq: 10 } },
      data: { state: "BLOCKED" },
    });
    await paid(drop.id, 1, [{ pizzaId: margherita.id, quantity: 1 }]);
    // Offene Reservierung zählt nicht als verkauft
    customer += 1;
    await reserveOrder({
      dropId: drop.id,
      startSeq: 3,
      items: [{ pizzaId: marinara.id, quantity: 1 }],
      ...f.customer(customer),
    });

    const prep = await loadPrepList(drop.id);
    if (!prep) throw new Error("Liste fehlt");
    expect(prep.capacity).toBe(9);
    expect(prep.basis).toBe("history");
    // frei 8, verteilt 3 : 1 → +6 / +2
    expect(prep.list.pizzas).toEqual([
      expect.objectContaining({ name: "Margherita", sold: 1, sellOut: 7 }),
      expect.objectContaining({ name: "Marinara", sold: 0, sellOut: 2 }),
    ]);
    expect(prep.list.dough).toEqual({
      sold: 1,
      sellOut: 9,
      withBuffer: Math.ceil(9 * (1 + prep.bufferPercent / 100)),
    });
    expect(prep.list.ingredients).toEqual([
      expect.objectContaining({
        name: `${RUN} Fior di Latte`,
        sold: 100,
        sellOut: 700,
      }),
      expect.objectContaining({
        name: `${RUN} Tomaten`,
        sold: 80,
        sellOut: 761,
      }),
    ]);
  });

  it("liefert null für einen unbekannten Drop", async () => {
    expect(await loadPrepList("gibt-es-nicht")).toBeNull();
  });
});
