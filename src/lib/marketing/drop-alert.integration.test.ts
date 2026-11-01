import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixtures } from "../../../test/db-fixtures";
import { db } from "@/lib/db";
import {
  CONSENT_VERSION,
  confirmMailsLastHour,
  confirmSubscription,
  sendDueDropAlerts,
  subscribe,
  unsubscribe,
  type AlertMail,
  type ConfirmMail,
} from "./drop-alert";

const RUN = `p7a-${Date.now().toString(36)}`;
const f = fixtures(RUN);
const email = (key: string) => `${RUN}-${key}@pizzadrop.test`;

function confirmations() {
  const sent: ConfirmMail[] = [];
  return {
    sent,
    sendConfirm: async (mail: ConfirmMail) => void sent.push(mail),
  };
}

function alerts() {
  const sent: AlertMail[] = [];
  return {
    sent,
    // Wie sendMail: einmal pro Schlüssel, über das Mail-Protokoll
    sendAlert: async (mail: AlertMail) => {
      sent.push(mail);
      await db.emailLog.create({
        data: {
          kind: "drop-alarm",
          to: mail.to,
          dedupeKey: mail.dedupeKey,
          providerId: "re_test",
        },
      });
      return "sent" as const;
    },
  };
}

let pizza: { id: string };

beforeAll(async () => {
  pizza = await f.pizza("Margherita", 1050);
});

afterAll(async () => {
  await db.emailLog.deleteMany({ where: { to: { startsWith: RUN } } });
  await db.subscriber.deleteMany({ where: { email: { startsWith: RUN } } });
  await f.cleanup();
  await db.$disconnect();
});

async function confirmed(key: string) {
  const c = confirmations();
  await subscribe(email(key), { sendConfirm: c.sendConfirm });
  expect(await confirmSubscription(c.sent[0].token)).toBe("confirmed");
  return db.subscriber.findUniqueOrThrow({ where: { email: email(key) } });
}

describe("Anmeldung mit Double-Opt-in", () => {
  it("legt eine offene Anmeldung an und schickt den Bestätigungslink", async () => {
    const c = confirmations();
    await subscribe(`  ${email("neu").toUpperCase()} `, {
      sendConfirm: c.sendConfirm,
    });
    const row = await db.subscriber.findUniqueOrThrow({
      where: { email: email("neu") },
    });
    expect(row.status).toBe("PENDING");
    expect(c.sent).toEqual([
      expect.objectContaining({
        to: email("neu"),
        token: row.token,
        dedupeKey: expect.stringContaining(row.id),
      }),
    ]);
    expect(row.token.length).toBeGreaterThanOrEqual(32);
  });

  it("bestätigt einmal; ein zweiter Klick oder ein falscher Link ändert nichts", async () => {
    const c = confirmations();
    await subscribe(email("klick"), { sendConfirm: c.sendConfirm });
    const token = c.sent[0].token;
    expect(await confirmSubscription(token)).toBe("confirmed");
    expect(await confirmSubscription(token)).toBe("already");
    expect(await confirmSubscription("falsch")).toBe("invalid");
    const row = await db.subscriber.findUniqueOrThrow({
      where: { email: email("klick") },
    });
    expect(row.status).toBe("CONFIRMED");
    expect(row.confirmedAt).not.toBeNull();
  });

  it("schickt Bestätigten keine Mail mehr, Abgemeldeten einen neuen Link", async () => {
    const before = await confirmed("wieder");
    const again = confirmations();
    await subscribe(email("wieder"), { sendConfirm: again.sendConfirm });
    expect(again.sent).toEqual([]);

    expect(await unsubscribe(before.token)).toBe("unsubscribed");
    expect(await unsubscribe(before.token)).toBe("unsubscribed");
    const restart = confirmations();
    await subscribe(email("wieder"), { sendConfirm: restart.sendConfirm });
    const row = await db.subscriber.findUniqueOrThrow({
      where: { email: email("wieder") },
    });
    expect(row.status).toBe("PENDING");
    // Neuer Schlüssel: der alte Abmeldelink bestätigt nichts
    expect(row.token).not.toBe(before.token);
    expect(restart.sent[0].token).toBe(row.token);
  });

  it("meldet einen unbekannten Abmeldelink", async () => {
    expect(await unsubscribe("gibt-es-nicht")).toBe("invalid");
  });
});

describe("sendDueDropAlerts", () => {
  it("schickt bestätigten Abonnenten einmal den Alarm für Drops im Verkauf", async () => {
    const yes = await confirmed("alarm-ja");
    const c = confirmations();
    await subscribe(email("alarm-offen"), { sendConfirm: c.sendConfirm });
    const out = await confirmed("alarm-ab");
    await unsubscribe(out.token);

    const onSale = await f.drop("im-verkauf", 4, [pizza.id]);
    const later = await f.drop("spaeter", 4, [pizza.id]);
    await db.drop.update({
      where: { id: later.id },
      data: {
        status: "SCHEDULED",
        saleStartsAt: new Date(Date.now() + 3_600_000),
      },
    });

    const a = alerts();
    const result = await sendDueDropAlerts(new Date(), {
      sendAlert: a.sendAlert,
      limit: 1000,
    });
    // Nur die Adressen dieses Tests; Bestätigte aus früheren Tests bekommen ihn zu Recht auch
    const mine = a.sent.filter(
      (m) => m.dropId === onSale.id && m.to.includes("-alarm-"),
    );
    expect(mine).toEqual([
      expect.objectContaining({
        to: email("alarm-ja"),
        dropId: onSale.id,
        unsubscribeToken: yes.token,
      }),
    ]);
    expect(result.sent).toBeGreaterThanOrEqual(1);

    // Zweiter Lauf: niemand bekommt den Alarm doppelt
    const b = alerts();
    await sendDueDropAlerts(new Date(), {
      sendAlert: b.sendAlert,
      limit: 1000,
    });
    expect(b.sent.filter((m) => m.to.startsWith(RUN))).toEqual([]);
  });

  it("verschickt pro Lauf höchstens das Limit und macht beim nächsten weiter", async () => {
    await confirmed("limit-1");
    await confirmed("limit-2");
    const drop = await f.drop("limit", 4, [pizza.id]);

    let total = 0;
    for (let run = 0; run < 50; run++) {
      const a = alerts();
      const result = await sendDueDropAlerts(new Date(), {
        sendAlert: a.sendAlert,
        limit: 1,
      });
      expect(a.sent.length).toBeLessThanOrEqual(1);
      total += a.sent.filter(
        (m) => m.dropId === drop.id && m.to.includes("-limit-"),
      ).length;
      if (result.remaining === 0) break;
    }
    expect(total).toBe(2);
  });
});

describe("Review: ehrlich zählen, Limit und Schutz", () => {
  it("meldet übersprungene und gescheiterte Mails; jeder Versuch zählt zum Limit", async () => {
    await confirmed("zaehl-1");
    await confirmed("zaehl-2");
    await f.drop("zaehlen", 4, [pizza.id]);

    let calls = 0;
    const skipped = await sendDueDropAlerts(new Date(), {
      limit: 1,
      sendAlert: async () => {
        calls += 1;
        return "skipped";
      },
    });
    expect(calls).toBe(1);
    expect(skipped).toMatchObject({ sent: 0, skipped: 1, failed: 0 });
    expect(skipped.remaining).toBeGreaterThan(0);

    calls = 0;
    const failed = await sendDueDropAlerts(new Date(), {
      limit: 1,
      sendAlert: async () => {
        calls += 1;
        throw new Error("Resend: Kontingent erschöpft");
      },
    });
    expect(calls).toBe(1);
    expect(failed).toMatchObject({ sent: 0, skipped: 0, failed: 1 });
  });

  it("schickt niemandem, der sich während des Laufs abgemeldet hat", async () => {
    const first = await confirmed("mitten-1");
    const second = await confirmed("mitten-2");
    const drop = await f.drop("mitten", 4, [pizza.id]);

    const sent: string[] = [];
    await sendDueDropAlerts(new Date(), {
      limit: 1000,
      sendAlert: async (mail) => {
        if (mail.dropId === drop.id && mail.to === first.email) {
          await unsubscribe(second.token);
        }
        if (mail.dropId === drop.id) sent.push(mail.to);
        return "sent";
      },
    });
    expect(sent).toContain(first.email);
    expect(sent).not.toContain(second.email);
  });

  it("verschickt keine Bestätigung, wenn das Stundenbudget erschöpft ist", async () => {
    const c = confirmations();
    await subscribe(email("budget"), {
      sendConfirm: c.sendConfirm,
      allowConfirm: async () => false,
    });
    expect(c.sent).toEqual([]);
    // Die Anmeldung bleibt offen; ein späterer Versuch schickt den Link
    const row = await db.subscriber.findUniqueOrThrow({
      where: { email: email("budget") },
    });
    expect(row.status).toBe("PENDING");
  });

  it("zählt die Bestätigungsmails der letzten Stunde", async () => {
    const before = await confirmMailsLastHour(new Date());
    await db.emailLog.createMany({
      data: [1, 2].map((i) => ({
        kind: "drop-alarm-bestaetigen",
        to: email(`zaehler-${i}`),
        dedupeKey: `${RUN}-zaehler-${i}`,
      })),
    });
    expect(await confirmMailsLastHour(new Date())).toBe(before + 2);
  });

  it("hält die Version des Einwilligungstexts fest", async () => {
    const row = await confirmed("einwilligung");
    expect(row.source).toContain(CONSENT_VERSION);
  });
});
