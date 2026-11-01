/**
 * Kitchen-Mode: Backreihenfolge, Ofen-Regeln, Plan-Ist-Vergleich und Ausgabe.
 * Reine Funktionen ohne Framework- oder Datenbankbezug (siehe docs/PLAN.md, 1.4 und 3.3).
 */
import type { OrderStatus, SlotStatus } from "./drops";

/** Im Schema gibt es noch PREP; der Kitchen-Mode nutzt nur diese drei Zustände. */
export type TicketStatus = "QUEUED" | "OVEN" | "DONE";

export type KitchenTicket = {
  id: string;
  seq: number;
  status: TicketStatus;
  slotStartsAt: Date;
  slotEndsAt: Date;
  ovenStartedAt: Date | null;
  doneAt: Date | null;
};

type TicketCore = Pick<KitchenTicket, "id" | "seq" | "status">;

const bySeq = (a: { seq: number }, b: { seq: number }) => a.seq - b.seq;

/** Die Slot-Timeline ist die Queue: ein Ofen, eine Pizza nach der anderen. */
export function kitchenQueue<T extends TicketCore>(tickets: readonly T[]) {
  const sorted = [...tickets].sort(bySeq);
  const queued = sorted.filter((t) => t.status === "QUEUED");
  return {
    current: sorted.find((t) => t.status === "OVEN") ?? null,
    next: queued[0] ?? null,
    later: queued.slice(1),
    done: sorted.filter((t) => t.status === "DONE"),
  };
}

/** In den Ofen darf nur die nächste Pizza, und nur wenn der Ofen leer ist. */
export function canStartTicket(
  ticketId: string,
  tickets: readonly TicketCore[],
): boolean {
  const { current, next } = kitchenQueue(tickets);
  return current === null && next?.id === ticketId;
}

export function canFinishTicket(
  ticketId: string,
  tickets: readonly TicketCore[],
): boolean {
  return tickets.some((t) => t.id === ticketId && t.status === "OVEN");
}

/**
 * Verzug in Sekunden (0 = im Plan): hochgerechnetes Ende der Pizza im Ofen – oder der
 * nächsten, als käme sie jetzt hinein – minus Ende ihres Slots. Lücken bauen Verzug ab.
 */
export function delaySeconds(
  tickets: readonly KitchenTicket[],
  slotSeconds: number,
  now: Date,
): number {
  const { current, next } = kitchenQueue(tickets);
  const slotMs = slotSeconds * 1000;
  let endMs: number;
  let planMs: number;
  if (current?.ovenStartedAt) {
    endMs = Math.max(current.ovenStartedAt.getTime() + slotMs, now.getTime());
    planMs = current.slotEndsAt.getTime();
  } else if (next) {
    endMs = now.getTime() + slotMs;
    planMs = next.slotEndsAt.getTime();
  } else {
    return 0;
  }
  return Math.max(0, Math.round((endMs - planMs) / 1000));
}

export type BakeAverage = { seconds: number; count: number };

/** Gemessene Ø-Ofenzeit der fertigen Pizzen. */
export function averageBakeSeconds(
  tickets: readonly KitchenTicket[],
): BakeAverage | null {
  const durations = tickets.flatMap((t) =>
    t.status === "DONE" && t.ovenStartedAt && t.doneAt
      ? [(t.doneAt.getTime() - t.ovenStartedAt.getTime()) / 1000]
      : [],
  );
  if (durations.length === 0) return null;
  const sum = durations.reduce((a, b) => a + b, 0);
  return {
    seconds: Math.round(sum / durations.length),
    count: durations.length,
  };
}

const HINT_MIN_COUNT = 3;
const HINT_STEP = 30;

/** „Du brauchst im Schnitt 5:20 – nächster Drop mit 5:30?“; null, wenn es passt. */
export function slotLengthHint(
  average: BakeAverage | null,
  slotSeconds: number,
): number | null {
  if (!average || average.count < HINT_MIN_COUNT) return null;
  const suggested = Math.ceil(average.seconds / HINT_STEP) * HINT_STEP;
  return Math.abs(suggested - slotSeconds) >= HINT_STEP ? suggested : null;
}

/** Bestellstatus aus ihren Tickets: abholbereit, sobald alle Pizzen fertig sind. */
export function orderStatusFromTickets(
  statuses: readonly TicketStatus[],
): "PAID" | "IN_PROGRESS" | "READY" {
  if (statuses.length > 0 && statuses.every((s) => s === "DONE")) {
    return "READY";
  }
  return statuses.some((s) => s !== "QUEUED") ? "IN_PROGRESS" : "PAID";
}

export function canPickUp(status: OrderStatus): boolean {
  return status === "READY";
}

export type TimelineEntry =
  | { kind: "ticket"; ticketId: string; startsAt: Date }
  | { kind: "gap"; startsAt: Date; count: number };

/** „Danach“: Slots nach `afterSeq`; aufeinanderfolgende Slots ohne Pizza werden zur Lücke. */
export function laterTimeline(
  slots: readonly { seq: number; startsAt: Date; ticketId: string | null }[],
  afterSeq: number,
  limit = 8,
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  for (const slot of [...slots].sort(bySeq)) {
    if (slot.seq <= afterSeq) continue;
    const last = entries.at(-1);
    if (slot.ticketId) {
      if (entries.length === limit) break;
      entries.push({
        kind: "ticket",
        ticketId: slot.ticketId,
        startsAt: slot.startsAt,
      });
    } else if (last?.kind === "gap") {
      last.count += 1;
    } else {
      if (entries.length === limit) break;
      entries.push({ kind: "gap", startsAt: slot.startsAt, count: 1 });
    }
  }
  return entries;
}

/** Puffer: der nächste freie Slot, der noch nicht begonnen hat. */
export function nextBlockableSlot(
  slots: readonly { id: string; startsAt: Date; status: SlotStatus }[],
  now: Date,
): string | null {
  const candidates = slots
    .filter((s) => s.status === "free" && s.startsAt > now)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return candidates[0]?.id ?? null;
}
