import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixtures } from "../../../test/db-fixtures";
import { reserveOrder } from "@/lib/booking/reserve";
import { db } from "@/lib/db";
import {
  joinWaitlist,
  leaveWaitlist,
  NOTICE_HEAD_START_MINUTES,
  sendDueWaitlistNotices,
  type WaitlistNotice,
} from "./waitlist";

const RUN = `p7b-${Date.now().toString(36)}`;
const f = fixtures(RUN);
const email = (key: string) => `${RUN}-${key}@pizzadrop.test`;

function notices(result: "sent" | "skipped" = "sent") {
  const sent: WaitlistNotice[] = [];
  return {
    sent,
    /** Nur die Benachrichtigungen dieses Testlaufs */
    mine: () => sent.filter((m) => m.to.startsWith(RUN)).map((m) => m.to),
    sendNotice: async (mail: WaitlistNotice) => {
      sent.push(mail);
      return result;
    },
  };
}

let pizza: { id: string };

beforeAll(async () => {
  pizza = await f.pizza("Margherita", 1050);
});

afterAll(async () => {
  await f.cleanup();
  await db.$disconnect();
});

async function reserve(
  dropId: string,
  i: number,
  startSeq: number,
  quantity = 2,
) {
  const result = await reserveOrder({
    ...f.customer(i),
    dropId,
    startSeq,
    items: [{ pizzaId: pizza.id, quantity }],
  });
  if (!result.ok) throw new Error(result.message);
  return result.orderId;
}

const entryOf = (dropId: string, key: string) =>
  db.waitlistEntry.findUnique({
    where: { dropId_email: { dropId, email: email(key) } },
  });

describe("joinWaitlist", () => {
  it("trägt mit Anzahl ein; ein zweiter Versuch ändert nur die Anzahl", async () => {
    const drop = await f.drop("eintragen", 4, [pizza.id]);
    expect(
      await joinWaitlist({
        dropId: drop.id,
        email: `  ${email("neu").toUpperCase()} `,
        quantity: 2,
      }),
    ).toBe("joined");
    const first = await entryOf(drop.id, "neu");
    expect(first).toMatchObject({ quantity: 2, notifiedAt: null });
    expect(first!.token.length).toBeGreaterThanOrEqual(32);

    expect(
      await joinWaitlist({ dropId: drop.id, email: email("neu"), quantity: 3 }),
    ).toBe("joined");
    const second = await entryOf(drop.id, "neu");
    expect(second).toMatchObject({ id: first!.id, quantity: 3 });
  });

  it("lehnt Anzahlen außerhalb von 1 bis zum Bestelllimit ab", async () => {
    const drop = await f.drop("anzahl", 4, [pizza.id]);
    for (const quantity of [0, 5, 1.5]) {
      expect(
        await joinWaitlist({ dropId: drop.id, email: email("anz"), quantity }),
      ).toBe("invalid");
    }
    expect(await entryOf(drop.id, "anz")).toBeNull();
  });

  it("nimmt nur Einträge für Drops im Verkauf an", async () => {
    const drop = await f.drop("abgesagt", 4, [pizza.id]);
    await db.drop.update({
      where: { id: drop.id },
      data: { status: "CANCELLED" },
    });
    expect(
      await joinWaitlist({ dropId: drop.id, email: email("zu"), quantity: 1 }),
    ).toBe("closed");
    expect(
      await joinWaitlist({
        dropId: "gibt-es-nicht",
        email: email("zu"),
        quantity: 1,
      }),
    ).toBe("closed");
  });
});

describe("leaveWaitlist", () => {
  it("löscht den Eintrag; ein zweiter Klick findet nichts mehr", async () => {
    const drop = await f.drop("austragen", 4, [pizza.id]);
    await joinWaitlist({ dropId: drop.id, email: email("raus"), quantity: 1 });
    const entry = await entryOf(drop.id, "raus");
    expect(await leaveWaitlist(entry!.token)).toBe("left");
    expect(await entryOf(drop.id, "raus")).toBeNull();
    expect(await leaveWaitlist(entry!.token)).toBe("invalid");
  });
});

describe("sendDueWaitlistNotices", () => {
  it("benachrichtigt der Reihe nach, sobald passende Slots frei werden", async () => {
    const drop = await f.drop("frei", 4, [pizza.id]);
    const first = await reserve(drop.id, 1, 1);
    const second = await reserve(drop.id, 2, 3);
    await db.order.update({ where: { id: second }, data: { status: "PAID" } });
    for (const [key, quantity] of [
      ["drei", 3],
      ["zwei", 2],
      ["eins", 1],
    ] as const) {
      await joinWaitlist({ dropId: drop.id, email: email(key), quantity });
    }

    const full = notices();
    await sendDueWaitlistNotices(new Date(), {
      sendNotice: full.sendNotice,
      limit: 100,
    });
    expect(full.mine()).toEqual([]);

    // Storno gibt die Slots 1–2 frei: „drei“ passt nicht, „zwei“ schon
    await db.order.update({
      where: { id: first },
      data: { status: "CANCELLED" },
    });
    const now = new Date();
    const freed = notices();
    const run = await sendDueWaitlistNotices(now, {
      sendNotice: freed.sendNotice,
      limit: 100,
    });
    expect(freed.mine()).toEqual([email("zwei")]);
    expect(freed.sent.find((m) => m.to === email("zwei"))).toMatchObject({
      quantity: 2,
      dropSlug: drop.slug,
      leaveToken: (await entryOf(drop.id, "zwei"))!.token,
    });
    expect(run.sent).toBeGreaterThanOrEqual(1);
    expect((await entryOf(drop.id, "zwei"))!.notifiedAt).not.toBeNull();

    // Vorsprung: Die Slots bleiben erst einmal für „zwei“ gedacht
    const soon = notices();
    await sendDueWaitlistNotices(now, {
      sendNotice: soon.sendNotice,
      limit: 100,
    });
    expect(soon.mine()).toEqual([]);

    // Danach kommt der Nächste an die Reihe, für den eine Folge frei ist
    const later = notices();
    await sendDueWaitlistNotices(
      new Date(now.getTime() + (NOTICE_HEAD_START_MINUTES + 1) * 60_000),
      { sendNotice: later.sendNotice, limit: 100 },
    );
    expect(later.mine()).toEqual([email("eins")]);
  });

  it("überspringt Einträge, die inzwischen selbst gebucht haben", async () => {
    const drop = await f.drop("gebucht", 4, [pizza.id]);
    await joinWaitlist({ dropId: drop.id, email: email("bucht"), quantity: 1 });
    const orderId = await reserveOrder({
      ...f.customer(9),
      email: email("bucht"),
      dropId: drop.id,
      startSeq: 1,
      items: [{ pizzaId: pizza.id, quantity: 1 }],
    });
    expect(orderId.ok).toBe(true);
    if (!orderId.ok) return;
    expect((await entryOf(drop.id, "bucht"))!.convertedOrderId).toBe(
      orderId.orderId,
    );

    const n = notices();
    await sendDueWaitlistNotices(new Date(), {
      sendNotice: n.sendNotice,
      limit: 100,
    });
    expect(n.mine()).toEqual([]);
  });

  it("vermerkt übersprungene Mails nicht als benachrichtigt", async () => {
    const drop = await f.drop("ohne-schluessel", 4, [pizza.id]);
    await joinWaitlist({ dropId: drop.id, email: email("skip"), quantity: 1 });

    const n = notices("skipped");
    const run = await sendDueWaitlistNotices(new Date(), {
      sendNotice: n.sendNotice,
      limit: 100,
    });
    expect(n.mine()).toEqual([email("skip")]);
    expect(run.skipped).toBeGreaterThanOrEqual(1);
    expect((await entryOf(drop.id, "skip"))!.notifiedAt).toBeNull();
  });

  it("schreibt nicht für Drops, die nicht mehr im Verkauf sind", async () => {
    const drop = await f.drop("vorbei", 4, [pizza.id]);
    await joinWaitlist({
      dropId: drop.id,
      email: email("vorbei"),
      quantity: 1,
    });
    await db.drop.update({
      where: { id: drop.id },
      data: { status: "SALE_CLOSED" },
    });
    const n = notices();
    await sendDueWaitlistNotices(new Date(), {
      sendNotice: n.sendNotice,
      limit: 100,
    });
    expect(n.mine()).toEqual([]);
  });

  it("verschickt pro Lauf höchstens das Limit", async () => {
    const drop = await f.drop("limit", 4, [pizza.id]);
    await joinWaitlist({ dropId: drop.id, email: email("lim-1"), quantity: 1 });
    await joinWaitlist({ dropId: drop.id, email: email("lim-2"), quantity: 1 });
    const n = notices();
    const run = await sendDueWaitlistNotices(new Date(), {
      sendNotice: n.sendNotice,
      limit: 1,
    });
    expect(n.sent.length).toBe(1);
    expect(run.remaining).toBeGreaterThanOrEqual(1);
  });
});
