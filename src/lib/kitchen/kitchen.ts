/**
 * Kitchen-Mode gegen die Datenbank: Board laden, Ofen bedienen, ausgeben, Puffer sperren.
 * Jede Änderung sperrt die Drop-Zeile und prüft danach den aktuellen Stand (siehe
 * docs/PLAN.md, 3.2 und 3.3) – so bleiben mehrere Küchengeräte synchron.
 */
import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { TicketStatus as DbTicketStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { isBusyError, lockDrop } from "@/lib/tx";
import { effectiveStatus, slotStatus } from "@/lib/domain/drops";
import {
  averageBakeSeconds,
  canFinishTicket,
  canPickUp,
  canStartTicket,
  delaySeconds,
  kitchenQueue,
  laterTimeline,
  nextBlockableSlot,
  orderStatusFromTickets,
  slotLengthHint,
  type KitchenTicket,
  type TicketStatus,
  type TimelineEntry,
} from "@/lib/domain/kitchen";

export type KitchenResult = { ok: true } | { ok: false; message: string };

type Tx = Prisma.TransactionClient;

class Rejection extends Error {}

const TX_OPTIONS = { maxWait: 10_000, timeout: 15_000 };

/** Kurzzeitig belegt (Sperre, Verbindung, Timeout): nochmal versuchen hilft. */
const BUSY =
  "Gerade viel los – bitte gleich noch einmal tippen. Die Anzeige aktualisiert sich.";
/** Alles andere ist ein echter Fehler, den Wiederholen nicht behebt. */
const BROKEN =
  "Technischer Fehler – bitte die Küchenleitung bzw. den Admin informieren.";

const TICKET_GONE =
  "Diese Pizza gibt es nicht mehr – die Bestellung wurde storniert.";

/** Führt eine Küchenaktion unter der Drop-Sperre aus und übersetzt Fehler in Meldungen. */
async function underDropLock(
  label: string,
  target: { id: string; missing: string },
  findDropId: (tx: Tx) => Promise<string | null>,
  work: (tx: Tx, dropId: string) => Promise<void>,
): Promise<KitchenResult> {
  try {
    await db.$transaction(async (tx) => {
      const dropId = await findDropId(tx);
      if (!dropId) throw new Rejection(target.missing);
      await lockDrop(tx, dropId);
      await work(tx, dropId);
    }, TX_OPTIONS);
    return { ok: true };
  } catch (error) {
    if (error instanceof Rejection)
      return { ok: false, message: error.message };
    console.error(`Küche: ${label} für ${target.id} fehlgeschlagen`, error);
    return { ok: false, message: isBusyError(error) ? BUSY : BROKEN };
  }
}

const ticketDropId = async (tx: Tx, ticketId: string) =>
  (
    await tx.kitchenTicket.findUnique({
      where: { id: ticketId },
      select: { slot: { select: { dropId: true } } },
    })
  )?.slot.dropId ?? null;

/** Tickets des Drops, erst unter der Sperre gelesen: ein Storno kann dazwischen liegen. */
async function dropTickets(tx: Tx, dropId: string, ticketId: string) {
  const tickets = (
    await tx.kitchenTicket.findMany({
      where: { slot: { dropId } },
      select: { id: true, seq: true, status: true, orderId: true },
    })
  ).map((t) => ({ ...t, status: toTicketStatus(t.status) }));
  const ticket = tickets.find((t) => t.id === ticketId);
  if (!ticket) throw new Rejection(TICKET_GONE);
  return { tickets, ticket };
}

/** Status der Bestellung aus ihren Tickets nachziehen (bezahlt → in Arbeit → abholbereit). */
async function syncOrderStatus(tx: Tx, orderId: string) {
  const tickets = await tx.kitchenTicket.findMany({
    where: { orderId },
    select: { status: true },
  });
  const status = orderStatusFromTickets(
    tickets.map((t) => toTicketStatus(t.status)),
  );
  const { count } = await tx.order.updateMany({
    where: { id: orderId, status: { in: ["PAID", "IN_PROGRESS", "READY"] } },
    data: { status },
  });
  // Sonst bliebe die Bestellung still stehen, während das Ticket weiterläuft.
  if (count === 0) throw new Rejection(TICKET_GONE);
}

export function startTicket(ticketId: string): Promise<KitchenResult> {
  return underDropLock(
    "Ofenstart",
    { id: ticketId, missing: TICKET_GONE },
    (tx) => ticketDropId(tx, ticketId),
    async (tx, dropId) => {
      const { tickets, ticket } = await dropTickets(tx, dropId, ticketId);
      if (!canStartTicket(ticketId, tickets)) {
        throw new Rejection(
          "Diese Pizza ist nicht dran – erst die Pizza im Ofen fertig melden.",
        );
      }
      await tx.kitchenTicket.update({
        where: { id: ticketId },
        data: { status: "OVEN", ovenStartedAt: new Date() },
      });
      await syncOrderStatus(tx, ticket.orderId);
    },
  );
}

export function finishTicket(ticketId: string): Promise<KitchenResult> {
  return underDropLock(
    "Fertig",
    { id: ticketId, missing: TICKET_GONE },
    (tx) => ticketDropId(tx, ticketId),
    async (tx, dropId) => {
      const { tickets, ticket } = await dropTickets(tx, dropId, ticketId);
      if (!canFinishTicket(ticketId, tickets)) {
        throw new Rejection("Diese Pizza ist nicht im Ofen.");
      }
      await tx.kitchenTicket.update({
        where: { id: ticketId },
        data: { status: "DONE", doneAt: new Date() },
      });
      await syncOrderStatus(tx, ticket.orderId);
    },
  );
}

const PICKUP_REFUSAL: Partial<Record<string, string>> = {
  PICKED_UP: "Diese Bestellung ist schon abgeholt.",
  CANCELLED: "Diese Bestellung wurde storniert – nicht ausgeben.",
  REFUNDED: "Diese Bestellung wurde storniert und erstattet – nicht ausgeben.",
  NO_SHOW: "Diese Bestellung ist als nicht abgeholt markiert.",
};

export function pickUpOrder(orderId: string): Promise<KitchenResult> {
  return underDropLock(
    "Ausgabe",
    { id: orderId, missing: "Diese Bestellung gibt es nicht." },
    async (tx) =>
      (
        await tx.order.findUnique({
          where: { id: orderId },
          select: { dropId: true },
        })
      )?.dropId ?? null,
    async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { status: true },
      });
      if (!order) throw new Rejection("Diese Bestellung gibt es nicht.");
      if (!canPickUp(order.status)) {
        throw new Rejection(
          PICKUP_REFUSAL[order.status] ??
            "Diese Bestellung ist noch nicht fertig.",
        );
      }
      await tx.order.update({
        where: { id: orderId },
        data: { status: "PICKED_UP", pickedUpAt: new Date() },
      });
    },
  );
}

/** Puffer: den nächsten freien Slot sperren, damit die Küche Verzug aufholt. */
export function blockNextSlot(dropId: string): Promise<KitchenResult> {
  return underDropLock(
    "Puffer",
    { id: dropId, missing: "Diesen Drop gibt es nicht mehr." },
    async (tx) =>
      (
        await tx.drop.findUnique({
          where: { id: dropId },
          select: { id: true },
        })
      )?.id ?? null,
    async (tx) => {
      const now = new Date();
      const slots = await tx.slot.findMany({
        where: { dropId },
        include: { order: { select: { status: true } } },
      });
      const slotId = nextBlockableSlot(
        slots.map((s) => ({
          id: s.id,
          startsAt: s.startsAt,
          status: slotStatus(
            { ...s, orderStatus: s.order?.status ?? null },
            now,
          ),
        })),
        now,
      );
      if (!slotId) throw new Rejection("Es kommt kein freier Slot mehr.");
      await tx.slot.update({
        where: { id: slotId },
        // Abgelaufene Reservierungen beim Sperren gleich mit lösen.
        data: { state: "BLOCKED", orderId: null, reservedUntil: null },
      });
    },
  );
}

/** Das Schema kennt noch PREP; die Küche behandelt es wie „wartet“. */
const TICKET_STATUS: Record<DbTicketStatus, TicketStatus> = {
  QUEUED: "QUEUED",
  PREP: "QUEUED",
  OVEN: "OVEN",
  DONE: "DONE",
};
const toTicketStatus = (status: DbTicketStatus) => TICKET_STATUS[status];

function pizzaSummary(items: { nameSnapshot: string; quantity: number }[]) {
  return items.map((i) => `${i.quantity} × ${i.nameSnapshot}`).join(", ");
}

/** Alles, was ein Küchengerät für die Anzeige braucht – inklusive Serverzeit für die Uhr. */
export async function loadKitchenBoard(dropId: string) {
  const drop = await db.drop.findUnique({
    where: { id: dropId },
    include: {
      slots: {
        orderBy: { seq: "asc" },
        include: {
          order: { select: { status: true } },
          ticket: {
            include: {
              pizza: { select: { name: true } },
              order: { select: { id: true, number: true, customerName: true } },
            },
          },
        },
      },
      orders: {
        // Alles, was je bezahlt war: auch Stornierte, damit die Ausgabe-Suche sie als
        // „nicht ausgeben“ zeigt statt als unbekannt.
        where: { status: { notIn: ["PENDING_PAYMENT", "EXPIRED"] } },
        orderBy: { pickupAt: "asc" },
        include: { items: { select: { nameSnapshot: true, quantity: true } } },
      },
    },
  });
  if (!drop) return null;
  const now = new Date();

  const raw = drop.slots.flatMap((slot) =>
    slot.ticket ? [{ slot, ticket: slot.ticket }] : [],
  );
  // Position innerhalb der Bestellung: „Pizza 1 von 2“ (Slots kommen in seq-Reihenfolge)
  const perOrder = new Map<string, number[]>();
  for (const { ticket } of raw) {
    const seqs = perOrder.get(ticket.orderId) ?? [];
    seqs.push(ticket.seq);
    perOrder.set(ticket.orderId, seqs);
  }
  const tickets = raw.map(({ slot, ticket }) => {
    const seqs = perOrder.get(ticket.orderId) ?? [];
    return {
      id: ticket.id,
      seq: ticket.seq,
      status: toTicketStatus(ticket.status),
      slotStartsAt: slot.startsAt,
      slotEndsAt: slot.endsAt,
      ovenStartedAt: ticket.ovenStartedAt,
      doneAt: ticket.doneAt,
      orderId: ticket.orderId,
      orderNumber: ticket.order.number,
      customer: ticket.order.customerName,
      pizza: ticket.pizza.name,
      position: seqs.indexOf(ticket.seq) + 1,
      of: seqs.length,
    };
  }) satisfies KitchenTicket[];

  type BoardEntry =
    | Extract<TimelineEntry, { kind: "gap" }>
    | (Extract<TimelineEntry, { kind: "ticket" }> & {
        ticket: (typeof tickets)[number];
      });

  const queue = kitchenQueue(tickets);
  const average = averageBakeSeconds(tickets);
  const ticketById = new Map(tickets.map((t) => [t.id, t]));
  const afterSeq = queue.next?.seq ?? queue.current?.seq ?? 0;

  const orders = drop.orders.map((o) => ({
    id: o.id,
    number: o.number,
    customer: o.customerName,
    pickupAt: o.pickupAt,
    pickupCode: o.pickupCode,
    pizzas: pizzaSummary(o.items),
    status: o.status,
  }));

  return {
    serverNow: now,
    drop: {
      id: drop.id,
      title: drop.title,
      slotSeconds: drop.slotSeconds,
      bakeStartsAt: drop.bakeStartsAt,
      bakeEndsAt: drop.bakeEndsAt,
      status: effectiveStatus(drop, now),
    },
    current: queue.current,
    next: queue.next,
    later: laterTimeline(
      drop.slots.map((s) => ({
        seq: s.seq,
        startsAt: s.startsAt,
        ticketId: s.ticket?.id ?? null,
      })),
      afterSeq,
    ).flatMap((entry): BoardEntry[] => {
      if (entry.kind === "gap") return [entry];
      const ticket = ticketById.get(entry.ticketId);
      return ticket ? [{ ...entry, ticket }] : [];
    }),
    doneCount: queue.done.length,
    totalCount: tickets.length,
    delaySeconds: delaySeconds(tickets, drop.slotSeconds, now),
    average,
    slotHint: slotLengthHint(average, drop.slotSeconds),
    orders,
    ready: orders.filter((o) => o.status === "READY"),
    pickedUp: orders.filter((o) => o.status === "PICKED_UP"),
    slots: drop.slots.map((s) => ({
      seq: s.seq,
      startsAt: s.startsAt,
      status: slotStatus({ ...s, orderStatus: s.order?.status ?? null }, now),
      ticketStatus: s.ticket
        ? (ticketById.get(s.ticket.id)?.status ?? null)
        : null,
    })),
  };
}

export type KitchenBoard = NonNullable<
  Awaited<ReturnType<typeof loadKitchenBoard>>
>;
