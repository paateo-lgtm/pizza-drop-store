import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixtures } from "../../../test/db-fixtures";
import { feedbackKey } from "@/lib/booking/order-link";
import { reserveOrder } from "@/lib/booking/reserve";
import { db } from "@/lib/db";
import { MAIL_FAILED } from "@/lib/mail/send";
import {
  sendDueFeedbackRequests,
  submitFeedback,
  withdrawFeedbackConsent,
  type FeedbackRequest,
} from "./feedback";

const RUN = `p7d-${Date.now().toString(36)}`;
const f = fixtures(RUN);
const HOUR = 3_600_000;

let pizza: { id: string };

beforeAll(async () => {
  pizza = await f.pizza("Margherita", 1050);
});

afterAll(async () => {
  await db.emailLog.deleteMany({ where: { to: { startsWith: RUN } } });
  await f.cleanup();
  await db.$disconnect();
});

let seq = 0;
/** Abgeholte Bestellung; `hours` = Stunden seit der Abholung */
async function pickedUp(
  customer: number,
  hours: number,
  consent = true,
  dropId?: string,
) {
  const drop = dropId ?? (await f.drop(`d${++seq}`, 4, [pizza.id])).id;
  const result = await reserveOrder({
    ...f.customer(customer),
    dropId: drop,
    startSeq: 1,
    items: [{ pizzaId: pizza.id, quantity: 1 }],
    feedbackConsent: consent,
  });
  if (!result.ok) throw new Error(result.message);
  return db.order.update({
    where: { id: result.orderId },
    data: {
      status: "PICKED_UP",
      pickedUpAt: new Date(Date.now() - hours * HOUR),
    },
  });
}

function requests(result: "sent" | "skipped" = "sent") {
  const sent: FeedbackRequest[] = [];
  return {
    sent,
    for: (ids: string[]) => sent.filter((r) => ids.includes(r.orderId)),
    // Wie sendMail: Versendetes steht im Mail-Protokoll
    sendRequest: async (mail: FeedbackRequest) => {
      sent.push(mail);
      if (result === "sent") {
        await db.emailLog.create({
          data: {
            kind: "feedback",
            to: mail.to,
            dedupeKey: mail.dedupeKey,
            providerId: "re_test",
          },
        });
      }
      return result;
    },
  };
}

describe("sendDueFeedbackRequests", () => {
  it("fragt einmal, nur mit Einwilligung und im Zeitfenster", async () => {
    const due = await pickedUp(1, 4);
    const noConsent = await pickedUp(2, 4, false);
    const tooEarly = await pickedUp(3, 1);
    const tooLate = await pickedUp(4, 80);
    const ids = [due.id, noConsent.id, tooEarly.id, tooLate.id];

    const first = requests();
    await sendDueFeedbackRequests(new Date(), {
      sendRequest: first.sendRequest,
      limit: 100,
    });
    expect(first.for(ids)).toEqual([
      expect.objectContaining({
        orderId: due.id,
        to: f.customer(1).email,
        orderNumber: due.number,
        feedbackPath: expect.stringContaining(`/feedback/${due.id}?k=`),
      }),
    ]);

    const second = requests();
    await sendDueFeedbackRequests(new Date(), {
      sendRequest: second.sendRequest,
      limit: 100,
    });
    expect(second.for(ids)).toEqual([]);
  });

  it("versucht übersprungene Mails im nächsten Lauf erneut", async () => {
    const order = await pickedUp(5, 4);
    const skipped = requests("skipped");
    const run = await sendDueFeedbackRequests(new Date(), {
      sendRequest: skipped.sendRequest,
      limit: 100,
    });
    expect(skipped.for([order.id])).toHaveLength(1);
    expect(run.skipped).toBeGreaterThanOrEqual(1);

    const retry = requests();
    await sendDueFeedbackRequests(new Date(), {
      sendRequest: retry.sendRequest,
      limit: 100,
    });
    expect(retry.for([order.id])).toHaveLength(1);
  });
});

describe("submitFeedback", () => {
  it("speichert eine Bewertung pro Bestellung", async () => {
    const order = await pickedUp(6, 4);
    const key = feedbackKey(order.id);
    expect(
      await submitFeedback({
        orderId: order.id,
        key,
        rating: 5,
        comment: "  Knusprig!  ",
      }),
    ).toBe("saved");
    expect(
      await db.feedback.findUnique({ where: { orderId: order.id } }),
    ).toMatchObject({ rating: 5, comment: "Knusprig!" });
    expect(
      await submitFeedback({ orderId: order.id, key, rating: 1, comment: "" }),
    ).toBe("done");
  });

  it("lehnt falsche Schlüssel, ungültige Sterne und nicht Abgeholtes ab", async () => {
    const order = await pickedUp(7, 4);
    const key = feedbackKey(order.id);
    const send = (over: Partial<Parameters<typeof submitFeedback>[0]>) =>
      submitFeedback({
        orderId: order.id,
        key,
        rating: 4,
        comment: "",
        ...over,
      });
    expect(await send({ key: "falsch" })).toBe("invalid");
    expect(await send({ rating: 6 })).toBe("invalid");
    expect(await send({ rating: 0 })).toBe("invalid");
    expect(await send({ comment: "x".repeat(1001) })).toBe("invalid");

    await db.order.update({
      where: { id: order.id },
      data: { status: "PAID", pickedUpAt: null },
    });
    expect(await send({})).toBe("closed");
    expect(await db.feedback.count({ where: { orderId: order.id } })).toBe(0);
  });
});

describe("Review: Warteschlange und Eingaben", () => {
  it("fragt neue Bestellungen vor solchen, deren Mail schon gescheitert ist", async () => {
    // Gescheitert und älter: stünde nach Abholzeit vorn in der Schlange
    const failing = await pickedUp(9, 71.5);
    await db.emailLog.create({
      data: {
        kind: "feedback",
        to: f.customer(9).email,
        dedupeKey: `feedback:${failing.id}`,
        providerId: MAIL_FAILED,
      },
    });
    const fresh = await pickedUp(10, 4);
    const r = requests();
    await sendDueFeedbackRequests(new Date(), {
      sendRequest: r.sendRequest,
      limit: 1,
    });
    expect(r.for([failing.id, fresh.id]).map((m) => m.orderId)).toEqual([
      fresh.id,
    ]);
  });

  it("entfernt Nullzeichen aus dem Kommentar", async () => {
    const order = await pickedUp(11, 4);
    expect(
      await submitFeedback({
        orderId: order.id,
        key: feedbackKey(order.id),
        rating: 3,
        comment: "gut\u0000 gemacht",
      }),
    ).toBe("saved");
    expect(
      await db.feedback.findUnique({ where: { orderId: order.id } }),
    ).toMatchObject({ comment: "gut gemacht" });
  });
});

describe("withdrawFeedbackConsent", () => {
  it("nimmt die Einwilligung für alle Bestellungen derselben Adresse zurück", async () => {
    const first = await pickedUp(8, 4);
    const second = await pickedUp(8, 5);
    expect(await withdrawFeedbackConsent(first.id, "falsch")).toBe("invalid");
    expect(await withdrawFeedbackConsent(first.id, feedbackKey(first.id))).toBe(
      "withdrawn",
    );

    const consents = await db.order.findMany({
      where: { id: { in: [first.id, second.id] } },
      select: { feedbackConsent: true },
    });
    expect(consents).toEqual([
      { feedbackConsent: false },
      { feedbackConsent: false },
    ]);
    const r = requests();
    await sendDueFeedbackRequests(new Date(), {
      sendRequest: r.sendRequest,
      limit: 100,
    });
    expect(r.for([first.id, second.id])).toEqual([]);
  });
});
