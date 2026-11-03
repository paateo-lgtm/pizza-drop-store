import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { subscribe } from "@/lib/marketing/drop-alert";
import {
  cleanupPersonalData,
  EMAIL_LOG_DAYS,
  PENDING_SUBSCRIBER_DAYS,
} from "./cleanup";

const RUN = `p10-${Date.now().toString(36)}`;
const NOW = new Date();
const DAY = 86_400_000;
const daysAgo = (d: number) => new Date(NOW.getTime() - d * DAY);
const email = (key: string) => `${RUN}-${key}@pizzadrop.test`;

async function log(key: string, createdAt: Date) {
  await db.emailLog.create({
    data: {
      kind: "test",
      to: email(key),
      dedupeKey: `${RUN}:${key}`,
      providerId: "gesendet",
      createdAt,
    },
  });
}

async function subscriber(
  key: string,
  status: "PENDING" | "CONFIRMED" | "UNSUBSCRIBED",
  createdAt: Date,
) {
  await db.subscriber.create({
    data: {
      email: email(key),
      token: `${RUN}-${randomUUID()}`,
      status,
      createdAt,
      confirmedAt: status === "PENDING" ? null : createdAt,
      unsubscribedAt: status === "UNSUBSCRIBED" ? createdAt : null,
    },
  });
}

beforeAll(async () => {
  await log("alt", daysAgo(EMAIL_LOG_DAYS + 1));
  await log("frisch", daysAgo(EMAIL_LOG_DAYS - 1));
  await subscriber(
    "offen-alt",
    "PENDING",
    daysAgo(PENDING_SUBSCRIBER_DAYS + 1),
  );
  await subscriber(
    "offen-neu",
    "PENDING",
    daysAgo(PENDING_SUBSCRIBER_DAYS - 1),
  );
  await subscriber("bestaetigt", "CONFIRMED", daysAgo(400));
  await subscriber("abgemeldet", "UNSUBSCRIBED", daysAgo(400));
});

afterAll(async () => {
  await db.emailLog.deleteMany({ where: { dedupeKey: { startsWith: RUN } } });
  await db.subscriber.deleteMany({ where: { email: { startsWith: RUN } } });
  await db.$disconnect();
});

describe("cleanupPersonalData", () => {
  it("löscht alte Versandprotokolle und nie bestätigte Anmeldungen", async () => {
    const run = await cleanupPersonalData(NOW);
    // Andere Daten in der geteilten Datenbank können mitgezählt werden
    expect(run.emailLogs).toBeGreaterThanOrEqual(1);
    expect(run.pendingSubscribers).toBeGreaterThanOrEqual(1);

    const logs = await db.emailLog.findMany({
      where: { dedupeKey: { startsWith: RUN } },
      select: { dedupeKey: true },
    });
    expect(logs.map((l) => l.dedupeKey)).toEqual([`${RUN}:frisch`]);

    const subscribers = await db.subscriber.findMany({
      where: { email: { startsWith: RUN } },
      select: { email: true },
      orderBy: { email: "asc" },
    });
    expect(subscribers.map((s) => s.email)).toEqual([
      email("abgemeldet"),
      email("bestaetigt"),
      email("offen-neu"),
    ]);
  });

  it("ein zweiter Lauf findet nichts mehr von uns", async () => {
    await cleanupPersonalData(NOW);
    expect(
      await db.subscriber.count({ where: { email: { startsWith: RUN } } }),
    ).toBe(3);
  });

  it("eine erneute Anmeldung nach langer Zeit gilt als neu und bleibt", async () => {
    // Abgemeldet vor über einem Jahr, jetzt wieder angemeldet (noch nicht bestätigt)
    await subscribe(email("abgemeldet"), { sendConfirm: async () => {} });
    expect(
      await db.subscriber.findUnique({
        where: { email: email("abgemeldet") },
        select: { status: true },
      }),
    ).toEqual({ status: "PENDING" });
    await cleanupPersonalData(new Date());
    expect(
      await db.subscriber.count({ where: { email: email("abgemeldet") } }),
    ).toBe(1);
  });
});
