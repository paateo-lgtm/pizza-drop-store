/**
 * Drop-Lebenszyklus, Raster-Vorschau und Slot-Zustände.
 * Reine Funktionen ohne Framework- oder Datenbankbezug (siehe docs/PLAN.md, 1.2 und 3.2).
 */
import { generateSlots } from "./slots";

export type DropStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "ON_SALE"
  | "SALE_CLOSED"
  | "LIVE"
  | "COMPLETED"
  | "CANCELLED";

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "IN_PROGRESS"
  | "READY"
  | "PICKED_UP"
  | "EXPIRED"
  | "CANCELLED"
  | "REFUNDED"
  | "NO_SHOW";

export type DropTimes = {
  saleStartsAt: Date;
  saleEndsAt: Date;
  bakeStartsAt: Date;
  bakeEndsAt: Date;
};

const PUBLISHED_ORDER: DropStatus[] = [
  "SCHEDULED",
  "ON_SALE",
  "SALE_CLOSED",
  "LIVE",
  "COMPLETED",
];

function statusByTime(times: DropTimes, now: Date): DropStatus {
  const t = now.getTime();
  if (t < times.saleStartsAt.getTime()) return "SCHEDULED";
  if (t < times.saleEndsAt.getTime()) return "ON_SALE";
  if (t < times.bakeStartsAt.getTime()) return "SALE_CLOSED";
  if (t < times.bakeEndsAt.getTime()) return "LIVE";
  return "COMPLETED";
}

/**
 * Gespeichert wird, was der Admin festlegt (veröffentlicht, früh geöffnet, früh geschlossen …).
 * Ab der Veröffentlichung schaltet die Zeit den Drop weiter; zurück geht es nie.
 */
export function effectiveStatus(
  drop: DropTimes & { status: DropStatus },
  now: Date,
): DropStatus {
  if (drop.status === "DRAFT" || drop.status === "CANCELLED") {
    return drop.status;
  }
  const stored = PUBLISHED_ORDER.indexOf(drop.status);
  const byTime = PUBLISHED_ORDER.indexOf(statusByTime(drop, now));
  return PUBLISHED_ORDER[Math.max(stored, byTime)];
}

/** Ab Verkaufsstart sind Backzeitraum und Slotlänge fix; Verzug fängt die Puffer-Sperre auf. */
export function isGridLocked(status: DropStatus): boolean {
  return status !== "DRAFT" && status !== "SCHEDULED";
}

export type DropAction =
  "publish" | "unpublish" | "openSale" | "closeSale" | "complete" | "cancel";

const ACTIONS: Record<DropStatus, DropAction[]> = {
  DRAFT: ["publish", "cancel"],
  SCHEDULED: ["unpublish", "openSale", "cancel"],
  ON_SALE: ["closeSale", "cancel"],
  SALE_CLOSED: ["complete", "cancel"],
  LIVE: ["complete", "cancel"],
  COMPLETED: [],
  CANCELLED: [],
};

const TARGET: Record<DropAction, DropStatus> = {
  publish: "SCHEDULED",
  unpublish: "DRAFT",
  openSale: "ON_SALE",
  closeSale: "SALE_CLOSED",
  complete: "COMPLETED",
  cancel: "CANCELLED",
};

/** Aktionen, die im aktuellen (effektiven) Status erlaubt sind. */
export function dropActions(status: DropStatus): DropAction[] {
  return ACTIONS[status];
}

/** Neuer gespeicherter Status nach einer Aktion, oder null, wenn sie hier nicht erlaubt ist. */
export function statusAfter(
  status: DropStatus,
  action: DropAction,
): DropStatus | null {
  return ACTIONS[status].includes(action) ? TARGET[action] : null;
}

export type GridInput = {
  bakeStartsAt: Date;
  bakeEndsAt: Date;
  slotSeconds: number;
  maxPizzasTotal: number | null;
};

export type GridSummary = {
  slotCount: number;
  /** Höchstens verkaufbare Pizzen: Slotanzahl oder die kleinere Obergrenze */
  capacity: number;
  firstPickupAt: Date;
  lastPickupAt: Date;
  /** Rest am Ende des Backzeitraums, der für eine ganze Pizza zu kurz ist */
  unusedSeconds: number;
};

/** Live-Vorschau: „15:00–20:00 bei 6 min = 50 Slots; erste Abholung 15:06, letzte 20:00“. */
export function describeGrid(input: GridInput): GridSummary | null {
  let slots;
  try {
    slots = generateSlots(
      input.bakeStartsAt,
      input.bakeEndsAt,
      input.slotSeconds,
    );
  } catch {
    return null;
  }
  const first = slots[0];
  const last = slots.at(-1);
  if (!first || !last) return null;
  return {
    slotCount: slots.length,
    capacity: Math.min(slots.length, input.maxPizzasTotal ?? Infinity),
    firstPickupAt: first.endsAt,
    lastPickupAt: last.endsAt,
    unusedSeconds: Math.round(
      (input.bakeEndsAt.getTime() - last.endsAt.getTime()) / 1000,
    ),
  };
}

export type DropIssue = {
  path: "saleStartsAt" | "saleEndsAt" | "bakeEndsAt" | "maxPizzasTotal";
  message: string;
};

/** Zeiten und Obergrenze eines Drops auf Stimmigkeit prüfen. */
export function validateDropTimes(
  input: DropTimes & { slotSeconds: number; maxPizzasTotal: number | null },
): DropIssue[] {
  const issues: DropIssue[] = [];
  const grid = describeGrid(input);

  if (input.bakeEndsAt <= input.bakeStartsAt) {
    issues.push({
      path: "bakeEndsAt",
      message: "Das Backende muss nach dem Backstart liegen",
    });
  } else if (!grid) {
    issues.push({
      path: "bakeEndsAt",
      message: "Der Backzeitraum ist zu kurz für eine Pizza",
    });
  }
  if (input.saleEndsAt <= input.saleStartsAt) {
    issues.push({
      path: "saleEndsAt",
      message: "Das Verkaufsende muss nach dem Verkaufsstart liegen",
    });
  } else if (input.saleEndsAt > input.bakeEndsAt) {
    issues.push({
      path: "saleEndsAt",
      message: "Der Verkauf muss spätestens mit dem Backende schließen",
    });
  }
  if (input.saleStartsAt >= input.bakeStartsAt) {
    issues.push({
      path: "saleStartsAt",
      message: "Der Verkauf muss vor dem Backstart beginnen",
    });
  }
  if (grid && input.maxPizzasTotal !== null) {
    if (input.maxPizzasTotal > grid.slotCount) {
      issues.push({
        path: "maxPizzasTotal",
        message: `Höchstens ${grid.slotCount} – so viele Slots hat der Backzeitraum`,
      });
    }
  }
  return issues;
}

export type SlotStatus = "free" | "reserved" | "sold" | "blocked";

const SOLD: OrderStatus[] = [
  "PAID",
  "IN_PROGRESS",
  "READY",
  "PICKED_UP",
  "NO_SHOW",
];

/** Anzeige-Zustand eines Slots aus Sperre, Bestellung und Reservierungsfrist. */
export function slotStatus(
  slot: {
    state: "FREE" | "BLOCKED";
    orderId: string | null;
    reservedUntil: Date | null;
    orderStatus: OrderStatus | null;
  },
  now: Date,
): SlotStatus {
  if (slot.state === "BLOCKED") return "blocked";
  if (!slot.orderId || !slot.orderStatus) return "free";
  if (SOLD.includes(slot.orderStatus)) return "sold";
  if (
    slot.orderStatus === "PENDING_PAYMENT" &&
    slot.reservedUntil &&
    slot.reservedUntil > now
  ) {
    return "reserved";
  }
  return "free";
}

/** Freie Slots sperren bzw. gesperrte freigeben – nur in der Zukunft und solange der Drop nicht beendet ist. */
export function canToggleSlotBlock(
  status: SlotStatus,
  slotEndsAt: Date,
  dropStatus: DropStatus,
  now: Date,
): boolean {
  if (dropStatus === "COMPLETED" || dropStatus === "CANCELLED") return false;
  if (status !== "free" && status !== "blocked") return false;
  return slotEndsAt > now;
}
