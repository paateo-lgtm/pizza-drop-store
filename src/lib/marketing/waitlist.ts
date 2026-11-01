/**
 * Warteliste gegen die Datenbank: Eintragen bei ausverkauftem Drop, Austragen und die
 * Benachrichtigung, sobald passende Slots frei werden (siehe docs/PLAN.md, 1.6). Freie
 * Slots entstehen durch Storno oder ablaufende Reservierungen; der Cron prüft beides
 * gleich, über die aktuelle Verfügbarkeit. Der Mailversand kommt als Abhängigkeit herein.
 */
import "server-only";
import { loadAvailability } from "@/lib/booking/availability";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { pickupOptions, SOLD_ORDER_STATUSES } from "@/lib/domain/booking";
import { entriesToNotify, waitlistMailKey } from "@/lib/domain/waitlist";
import type { MailResult } from "@/lib/mail/send";
import { getSettings } from "@/lib/settings";
import { newToken, normalizeEmail, type AlertRun } from "./drop-alert";

export type WaitlistNotice = {
  to: string;
  dedupeKey: string;
  entryId: string;
  dropSlug: string;
  dropTitle: string;
  quantity: number;
  bakeStartsAt: Date;
  saleEndsAt: Date;
  leaveToken: string;
};

/**
 * So lange gelten frei gewordene Slots als den zuletzt Benachrichtigten versprochen.
 * Danach kommt der Nächste dran, falls die Slots noch frei sind.
 */
export const NOTICE_HEAD_START_MINUTES = 15;

/**
 * Ohne gültige eigene Buchung: nie gebucht, oder die Reservierung ist verfallen bzw.
 * die Bestellung storniert. Solche Einträge warten (wieder).
 */
const withoutBooking = (now: Date): Prisma.WaitlistEntryWhereInput => ({
  OR: [
    { convertedOrderId: null },
    {
      convertedOrder: {
        status: { notIn: [...SOLD_ORDER_STATUSES, "PENDING_PAYMENT"] },
      },
    },
    { convertedOrder: { status: "PENDING_PAYMENT", expiresAt: { lte: now } } },
  ],
});

/**
 * Eintragen oder die Anzahl ändern, solange die gewünschte Anzahl gerade nicht buchbar
 * ist. Die Antwort verrät nicht, ob die Adresse schon eingetragen war. Es geht keine
 * Mail hinaus: Geschrieben wird erst, wenn Slots frei werden.
 */
export async function joinWaitlist(
  input: { dropId: string; email: string; quantity: number },
  now = new Date(),
): Promise<"joined" | "available" | "closed" | "invalid"> {
  const { reservationMinutes } = await getSettings();
  const availability = await loadAvailability(
    db,
    { id: input.dropId },
    now,
    reservationMinutes,
  );
  if (availability?.drop.status !== "ON_SALE") return "closed";
  const { drop, slots, earliestStart, remaining } = availability;
  const { quantity } = input;
  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > drop.maxPizzasPerOrder
  ) {
    return "invalid";
  }
  // Wer jetzt buchen kann, soll buchen: Sonst ginge die Mail sofort beim nächsten Lauf raus.
  if (
    quantity <= remaining &&
    pickupOptions(slots, quantity, earliestStart).length > 0
  ) {
    return "available";
  }

  const email = normalizeEmail(input.email);
  await db.waitlistEntry.createMany({
    data: [{ dropId: drop.id, email, quantity, token: newToken() }],
    skipDuplicates: true,
  });
  // Nach Benachrichtigung oder Buchung bleibt der Eintrag, wie er war.
  await db.waitlistEntry.updateMany({
    where: {
      dropId: drop.id,
      email,
      notifiedAt: null,
      convertedOrderId: null,
    },
    data: { quantity },
  });
  return "joined";
}

/** Austragen löscht den Eintrag (Datensparsamkeit); ein zweiter Klick findet nichts. */
export async function leaveWaitlist(
  token: string,
): Promise<"left" | "invalid"> {
  const { count } = await db.waitlistEntry.deleteMany({ where: { token } });
  return count > 0 ? "left" : "invalid";
}

/**
 * Benachrichtigt Wartende, sobald für ihre Anzahl Slots am Stück frei sind. Jeder
 * Versuch zählt zum `limit`; nach `deadline` (ms seit Epoche) bricht der Lauf ab.
 * Übersprungene und gescheiterte Mails versucht der nächste Lauf erneut.
 * Einträge vergangener oder abgesagter Drops löscht der Lauf vorab (Datensparsamkeit).
 */
export async function sendDueWaitlistNotices(
  now: Date,
  deps: {
    sendNotice: (mail: WaitlistNotice) => Promise<MailResult>;
    limit: number;
    deadline?: number;
  },
): Promise<AlertRun> {
  await db.waitlistEntry.deleteMany({
    where: {
      drop: { OR: [{ bakeEndsAt: { lt: now } }, { status: "CANCELLED" }] },
    },
  });

  const drops = await db.drop.findMany({
    where: {
      status: { in: ["SCHEDULED", "ON_SALE"] },
      saleEndsAt: { gt: now },
      waitlist: { some: { notifiedAt: null, ...withoutBooking(now) } },
    },
    orderBy: { saleStartsAt: "asc" },
    select: { id: true },
  });
  const { reservationMinutes } = await getSettings();
  const headStart = new Date(
    now.getTime() - NOTICE_HEAD_START_MINUTES * 60_000,
  );

  const run: AlertRun = { sent: 0, skipped: 0, failed: 0, remaining: 0 };
  let attempts = 0;
  for (const { id } of drops) {
    const availability = await loadAvailability(
      db,
      { id },
      now,
      reservationMinutes,
    );
    if (availability?.drop.status !== "ON_SALE") continue;
    const { drop, slots, earliestStart, remaining } = availability;

    // Wer gerade selbst gebucht hat, hält seine Slots schon per Reservierung.
    const entries = await db.waitlistEntry.findMany({
      where: {
        dropId: id,
        AND: [
          withoutBooking(now),
          { OR: [{ notifiedAt: null }, { notifiedAt: { gt: headStart } }] },
        ],
      },
      orderBy: { createdAt: "asc" },
    });
    const waiting = entries.filter((e) => e.notifiedAt === null);
    const due = new Set(
      entriesToNotify({
        waiting,
        promised: entries.filter((e) => e.notifiedAt !== null),
        slots,
        earliestStart,
        available: remaining,
      }),
    );

    for (const entry of waiting.filter((e) => due.has(e.id))) {
      const outOfTime =
        deps.deadline !== undefined && Date.now() > deps.deadline;
      if (attempts >= deps.limit || outOfTime) {
        run.remaining += 1;
        continue;
      }
      attempts += 1;
      try {
        const result = await deps.sendNotice({
          to: entry.email,
          dedupeKey: waitlistMailKey(entry.id),
          entryId: entry.id,
          dropSlug: drop.slug,
          dropTitle: drop.title,
          quantity: entry.quantity,
          bakeStartsAt: drop.bakeStartsAt,
          saleEndsAt: drop.saleEndsAt,
          leaveToken: entry.token,
        });
        if (result === "skipped") {
          run.skipped += 1;
          run.remaining += 1;
          continue;
        }
        if (result === "sent") run.sent += 1;
        // Auch "duplicate": Die Mail ist schon draußen. updateMany, falls inzwischen ausgetragen.
        await db.waitlistEntry.updateMany({
          where: { id: entry.id },
          data: { notifiedAt: now },
        });
      } catch (error) {
        console.error(`Warteliste: Mail an ${entry.id} fehlgeschlagen`, error);
        run.failed += 1;
        run.remaining += 1;
      }
    }
  }
  return run;
}
