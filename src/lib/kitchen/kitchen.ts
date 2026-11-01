/**
 * Kitchen-Mode gegen die Datenbank: Board laden, Ofen bedienen, ausgeben, Puffer sperren.
 * Jede Änderung sperrt die Drop-Zeile und prüft danach den aktuellen Stand (siehe
 * docs/PLAN.md, 3.2 und 3.3) – so bleiben mehrere Küchengeräte synchron.
 */
import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
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
} from "@/lib/domain/kitchen";

export type KitchenResult = { ok: true } | { ok: false; message: string };

type Tx = Prisma.TransactionClient;

class Rejection extends Error {}

const TX_OPTIONS = { maxWait: 10_000, timeout: 15_000 };

const BUSY =
  "Das hat nicht geklappt – bitte gleich noch einmal tippen. Die Anzeige aktualisiert sich.";

async function lockDrop(tx: Tx, dropId: string) {
  await tx.$queryRaw`SELECT id FROM "Drop" WHERE id = ${dropId} FOR UPDATE`;
}

/** Führt eine Küchenaktion unter der Drop-Sperre aus und übersetzt Fehler in Meldungen. */
async function underDropLock(
  label: string,
  findDropId: (tx: Tx) => Promise<string | null>,
  work: (tx: Tx, dropId: string) => Promise<void>,
): Promise<KitchenResult> {
  try {
    await db.$transaction(async (tx) => {
      const dropId = await findDropId(tx);
      if (!dropId) throw new Rejection("Das gibt es nicht mehr.");
      await lockDrop(tx, dropId);
      await work(tx, dropId);
    }, TX_OPTIONS);
    return { ok: true };
  } catch (error) {
    if (error instanceof Rejection)
      return { ok: false, message: error.message };
    console.error(`Küche: ${label} fehlgeschlagen`, error);
    return { ok: false, message: BUSY };
  }
}

const ticketDropId = async (tx: Tx, ticketId: string) =>
  (
    await tx.kitchenTicket.findUnique({
      where: { id: ticketId },
      select: { slot: { select: { dropId: true } } },
    })
  )?.slot.dropId ?? null;

async function dropTickets(tx: Tx, dropId: string) {
  return tx.kitchenTicket.findMany({
    where: { slot: { dropId } },
    select: { id: true, seq: true, status: true, orderId: true },
  });
}

/** Status der Bestellung aus ihren Tickets nachziehen (bezahlt → in Arbeit → abholbereit). */
async function syncOrderStatus(tx: Tx, orderId: string) {
  const tickets = await tx.kitchenTicket.findMany({
    where: { orderId },
    select: { status: true },
  });
  const status = orderStatusFromTickets(
    tickets.map((t) => t.status as TicketStatus),
  );
  await tx.order.updateMany({
    where: { id: orderId, status: { in: ["PAID", "IN_PROGRESS", "READY"] } },
    data: { status },
  });
}

export function startTicket(ticketId: string): Promise<KitchenResult> {
  return underDropLock(
    "Ofenstart",
    (tx) => ticketDropId(tx, ticketId),
    async (tx, dropId) => {
      const tickets = await dropTickets(tx, dropId);
      if (!canStartTicket(ticketId, narrow(tickets))) {
        throw new Rejection(
          "Diese Pizza ist nicht dran – erst die Pizza im Ofen fertig melden.",
        );
      }
      const ticket = await tx.kitchenTicket.update({
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
    (tx) => ticketDropId(tx, ticketId),
    async (tx, dropId) => {
      const tickets = await dropTickets(tx, dropId);
      if (!canFinishTicket(ticketId, narrow(tickets))) {
        throw new Rejection("Diese Pizza ist nicht im Ofen.");
      }
      const ticket = await tx.kitchenTicket.update({
        where: { id: ticketId },
        data: { status: "DONE", doneAt: new Date() },
      });
      await syncOrderStatus(tx, ticket.orderId);
    },
  );
}

export function pickUpOrder(orderId: string): Promise<KitchenResult> {
  return underDropLock(
    "Ausgabe",
    async (tx) =>
      (
        await tx.order.findUnique({
          where: { id: orderId },
          select: { dropId: true },
        })
      )?.dropId ?? null,
    async (tx) => {
      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        select: { status: true },
      });
      if (!canPickUp(order.status)) {
        throw new Rejection(
          order.status === "PICKED_UP"
            ? "Diese Bestellung ist schon abgeholt."
            : "Diese Bestellung ist noch nicht fertig.",
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

/** Tickets im Schema kennen noch PREP; die Küche behandelt es wie „wartet“. */
function narrow<T extends { status: string }>(
  tickets: T[],
): (T & { status: TicketStatus })[] {
  return tickets.map((t) => ({
    ...t,
    status: t.status === "PREP" ? "QUEUED" : (t.status as TicketStatus),
  }));
}

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
        where: { status: { in: ["READY", "PICKED_UP"] } },
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
  // Position innerhalb der Bestellung: „Pizza 1 von 2“
  const perOrder = new Map<string, number[]>();
  for (const { ticket } of raw) {
    perOrder.set(ticket.orderId, [
      ...(perOrder.get(ticket.orderId) ?? []),
      ticket.seq,
    ]);
  }
  const tickets = narrow(
    raw.map(({ slot, ticket }) => {
      const seqs = (perOrder.get(ticket.orderId) ?? []).sort((a, b) => a - b);
      return {
        id: ticket.id,
        seq: ticket.seq,
        status: ticket.status,
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
    }),
  ) satisfies KitchenTicket[];

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
    ).map((entry) =>
      entry.kind === "ticket"
        ? { ...entry, ticket: ticketById.get(entry.ticketId)! }
        : entry,
    ),
    doneCount: queue.done.length,
    totalCount: tickets.length,
    delaySeconds: delaySeconds(tickets, drop.slotSeconds, now),
    average,
    slotHint: slotLengthHint(average, drop.slotSeconds),
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
