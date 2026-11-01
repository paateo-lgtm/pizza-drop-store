/**
 * Testdaten für Integrationstests gegen DATABASE_URL (lokal: Neon-Zweig "dev").
 * Jede Instanz merkt sich, was sie angelegt hat, und räumt es mit `cleanup()` wieder ab.
 */
import { db } from "@/lib/db";
import { generateSlots } from "@/lib/domain/slots";

const HOUR = 3_600_000;

export function fixtures(run: string) {
  const pizzaIds: string[] = [];
  const dropIds: string[] = [];

  return {
    async pizza(name: string, priceCents: number) {
      const pizza = await db.pizza.create({
        data: {
          slug: `${run}-${name.toLowerCase()}`,
          name,
          description: "Testpizza",
          priceCents,
        },
      });
      pizzaIds.push(pizza.id);
      return pizza;
    },

    /** Drop im Verkauf, Backbeginn morgen, `slotCount` Slots à 6 min. */
    async drop(key: string, slotCount: number, pizzaIdsOnMenu: string[]) {
      const now = Date.now();
      const bakeStartsAt = new Date(now + 24 * HOUR);
      const bakeEndsAt = new Date(bakeStartsAt.getTime() + slotCount * 360_000);
      const drop = await db.drop.create({
        data: {
          slug: `${run}-${key}`,
          title: `Test ${key}`,
          status: "ON_SALE",
          saleStartsAt: new Date(now - HOUR),
          saleEndsAt: new Date(now + 23 * HOUR),
          bakeStartsAt,
          bakeEndsAt,
          slotSeconds: 360,
          pizzas: {
            create: pizzaIdsOnMenu.map((pizzaId, i) => ({
              pizzaId,
              sortOrder: i,
            })),
          },
          slots: { create: generateSlots(bakeStartsAt, bakeEndsAt, 360) },
        },
      });
      dropIds.push(drop.id);
      return drop;
    },

    customer: (i: number) => ({
      name: `Gast ${i}`,
      email: `${run}-${i}@pizzadrop.test`,
      phone: "0171 2345678",
      feedbackConsent: false,
    }),

    async cleanup() {
      await db.processedWebhookEvent.deleteMany({
        where: { id: { startsWith: run } },
      });
      await db.order.deleteMany({ where: { dropId: { in: dropIds } } });
      await db.drop.deleteMany({ where: { id: { in: dropIds } } });
      await db.pizza.deleteMany({ where: { id: { in: pizzaIds } } });
      await db.customer.deleteMany({ where: { email: { startsWith: run } } });
    },
  };
}
