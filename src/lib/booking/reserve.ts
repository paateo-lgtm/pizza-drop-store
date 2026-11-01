import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  checkCart,
  generatePickupCode,
  pickupOptions,
  priceBreakdown,
  SOLD_ORDER_STATUSES,
} from "@/lib/domain/booking";
import { getSettings, type Settings } from "@/lib/settings";
import { isBusyError, lockDrop } from "@/lib/tx";
import { type FieldErrors, toFormState } from "@/lib/validation/common";
import {
  reservationSchema,
  type ReservationInput,
} from "@/lib/validation/booking";
import { loadAvailability } from "./availability";

export type ReserveResult =
  | { ok: true; orderId: string }
  | {
      ok: false;
      message: string;
      /** Verfügbarkeit hat sich geändert: Der Client sollte neu laden und neu wählen. */
      conflict: boolean;
      fieldErrors?: FieldErrors;
    };

// Buchungen eines Drops laufen nacheinander (Zeilensperre). maxWait deckt die Wartezeit
// auf eine freie Verbindung ab, wenn viele Kunden gleichzeitig bestellen.
const TX_OPTIONS = { maxWait: 10_000, timeout: 15_000 };
const ATTEMPTS = 3;

const BUSY: ReserveResult = {
  ok: false,
  conflict: false,
  message:
    "Gerade bestellen sehr viele gleichzeitig. Bitte versuch es in einem Moment noch einmal.",
};

/** Bricht die Transaktion ab (Rollback) und liefert das Ergebnis für den Kunden. */
class Rejection extends Error {
  constructor(readonly result: Extract<ReserveResult, { ok: false }>) {
    super(result.message);
  }
}

/**
 * Reserviert n aufeinanderfolgende Slots für eine Bestellung (docs/PLAN.md, 3.2):
 * Drop-Zeile sperren, Stand neu lesen, prüfen, Order PENDING_PAYMENT anlegen, Slots belegen.
 * `fixedNow` nur für Tests; sonst gilt die Zeit nach dem Sperren.
 */
export async function reserveOrder(
  raw: unknown,
  fixedNow?: Date,
): Promise<ReserveResult> {
  const parsed = reservationSchema.safeParse(raw);
  if (!parsed.success) {
    const state = toFormState(parsed.error)!;
    return {
      ok: false,
      conflict: false,
      message: state.message ?? "Bitte die markierten Felder prüfen.",
      fieldErrors: state.fieldErrors,
    };
  }
  const settings = await getSettings();

  for (let attempt = 1; ; attempt++) {
    try {
      return await db.$transaction(
        (tx) => reserveInTransaction(tx, parsed.data, settings, fixedNow),
        TX_OPTIONS,
      );
    } catch (error) {
      if (error instanceof Rejection) return error.result;
      // Zu lange auf Verbindung oder Sperre gewartet: Last melden statt Fehlerseite.
      if (isBusyError(error)) {
        console.warn("Reservierung abgebrochen (Datenbank belegt)", error);
        return BUSY;
      }
      const known = error instanceof Prisma.PrismaClientKnownRequestError;
      // Doppelter Abholcode: mit neuem Code wiederholen.
      if (!(known && error.code === "P2002" && attempt < ATTEMPTS)) throw error;
    }
  }
}

async function reserveInTransaction(
  tx: Prisma.TransactionClient,
  input: ReservationInput,
  settings: Settings,
  fixedNow: Date | undefined,
): Promise<ReserveResult> {
  await lockDrop(tx, input.dropId);
  // Erst nach dem Warten auf die Sperre: Die Reservierung gilt volle reservationMinutes.
  const now = fixedNow ?? new Date();

  // Pro E-Mail höchstens eine offene Reservierung je Drop: Eine neue löst die alte ab.
  // Scheitert die neue Buchung, rollt die Transaktion die Freigabe zurück (Rejection).
  const existing = await tx.customer.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (existing) {
    const open = await tx.order.findMany({
      where: {
        dropId: input.dropId,
        customerId: existing.id,
        status: "PENDING_PAYMENT",
        expiresAt: { gt: now },
      },
      select: { id: true },
    });
    if (open.length > 0) {
      const ids = open.map((o) => o.id);
      await tx.slot.updateMany({
        where: { orderId: { in: ids } },
        data: { orderId: null, reservedUntil: null },
      });
      await tx.order.updateMany({
        where: { id: { in: ids } },
        data: { status: "EXPIRED" },
      });
    }
  }

  const availability = await loadAvailability(
    tx,
    { id: input.dropId },
    now,
    settings.reservationMinutes,
  );
  if (!availability || availability.drop.status !== "ON_SALE") {
    throw new Rejection({
      ok: false,
      conflict: false,
      message: "Für diesen Drop läuft gerade kein Verkauf.",
    });
  }
  const { drop, menu, slots, remaining, earliestStart } = availability;

  const cart = checkCart(input.items, menu, {
    maxPerOrder: drop.maxPizzasPerOrder,
    remaining,
  });
  if (!cart.ok) {
    throw new Rejection({ ok: false, conflict: true, message: cart.message });
  }

  const option = pickupOptions(slots, cart.quantity, earliestStart).find(
    (o) => o.startSeq === input.startSeq,
  );
  if (!option) {
    throw new Rejection({
      ok: false,
      conflict: true,
      message:
        "Diese Abholzeit ist gerade vergeben worden. Bitte wähle eine andere.",
    });
  }

  // Ein bestehender Kunde wird nie überschrieben: Wer nur die E-Mail kennt, darf Name und
  // Telefon eines anderen nicht ändern. Der Kontakt dieser Bestellung steht an der Order.
  const customer =
    existing ??
    (await tx.customer.upsert({
      where: { email: input.email },
      update: {},
      create: { email: input.email, name: input.name, phone: input.phone },
      select: { id: true },
    }));

  const expiresAt = new Date(
    now.getTime() + settings.reservationMinutes * 60_000,
  );
  const prices = priceBreakdown(cart.subtotalCents, 0, settings.vatRatePercent);
  const order = await tx.order.create({
    data: {
      dropId: drop.id,
      customerId: customer.id,
      customerName: input.name,
      customerPhone: input.phone,
      ...prices,
      pickupAt: option.pickupAt,
      pickupCode: generatePickupCode(),
      note: input.note,
      feedbackConsent: input.feedbackConsent,
      expiresAt,
      items: {
        create: cart.items.map((item) => ({
          pizzaId: item.pizzaId,
          nameSnapshot: item.name,
          unitPriceCents: item.unitPriceCents,
          quantity: item.quantity,
        })),
      },
    },
    select: { id: true },
  });

  // Dieselbe Regel wie slotStatus(): frei, wenn ohne Bestellung oder die Bestellung den
  // Slot nicht (mehr) hält. Zweite Absicherung neben der Zeilensperre.
  const { count } = await tx.slot.updateMany({
    where: {
      dropId: drop.id,
      seq: { in: option.seqs },
      state: "FREE",
      OR: [
        { orderId: null },
        {
          order: {
            status: { notIn: [...SOLD_ORDER_STATUSES, "PENDING_PAYMENT"] },
          },
        },
        { order: { status: "PENDING_PAYMENT" }, reservedUntil: null },
        { order: { status: "PENDING_PAYMENT" }, reservedUntil: { lte: now } },
      ],
    },
    data: { orderId: order.id, reservedUntil: expiresAt },
  });
  if (count !== option.seqs.length) {
    // Kann unter der Zeilensperre nicht passieren; sonst lieber abbrechen als doppelt vergeben.
    throw new Error("Slots konnten nicht vollständig reserviert werden");
  }
  return { ok: true, orderId: order.id };
}
