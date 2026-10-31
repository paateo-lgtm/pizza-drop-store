import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  checkCart,
  generatePickupCode,
  pickupOptions,
  priceBreakdown,
} from "@/lib/domain/booking";
import { getSettings, type Settings } from "@/lib/settings";
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

/**
 * Reserviert n aufeinanderfolgende Slots für eine Bestellung (docs/PLAN.md, 3.2):
 * Drop-Zeile sperren, Stand neu lesen, prüfen, Order PENDING_PAYMENT anlegen, Slots belegen.
 */
export async function reserveOrder(
  raw: unknown,
  now = new Date(),
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
        (tx) => reserveInTransaction(tx, parsed.data, settings, now),
        TX_OPTIONS,
      );
    } catch (error) {
      // Eindeutigkeit verletzt: doppelter Abholcode oder gleichzeitig angelegter Kunde.
      const retry =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        attempt < ATTEMPTS;
      if (!retry) throw error;
    }
  }
}

async function reserveInTransaction(
  tx: Prisma.TransactionClient,
  input: ReservationInput,
  settings: Settings,
  now: Date,
): Promise<ReserveResult> {
  await tx.$queryRaw`SELECT id FROM "Drop" WHERE id = ${input.dropId} FOR UPDATE`;
  const availability = await loadAvailability(
    tx,
    { id: input.dropId },
    now,
    settings.reservationMinutes,
  );
  if (!availability || availability.drop.status !== "ON_SALE") {
    return {
      ok: false,
      conflict: false,
      message: "Für diesen Drop läuft gerade kein Verkauf.",
    };
  }
  const { drop, menu, slots, remaining, earliestStart } = availability;

  const cart = checkCart(input.items, menu, {
    maxPerOrder: drop.maxPizzasPerOrder,
    remaining,
  });
  if (!cart.ok) {
    return { ok: false, conflict: true, message: cart.message };
  }

  const option = pickupOptions(slots, cart.quantity, earliestStart).find(
    (o) => o.startSeq === input.startSeq,
  );
  if (!option) {
    return {
      ok: false,
      conflict: true,
      message:
        "Diese Abholzeit ist gerade vergeben worden. Bitte wähle eine andere.",
    };
  }

  const customer = await tx.customer.upsert({
    where: { email: input.email },
    update: { name: input.name, phone: input.phone },
    create: { email: input.email, name: input.name, phone: input.phone },
    select: { id: true },
  });

  const expiresAt = new Date(
    now.getTime() + settings.reservationMinutes * 60_000,
  );
  const prices = priceBreakdown(cart.subtotalCents, 0, settings.vatRatePercent);
  const order = await tx.order.create({
    data: {
      dropId: drop.id,
      customerId: customer.id,
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

  const { count } = await tx.slot.updateMany({
    where: { dropId: drop.id, seq: { in: option.seqs }, state: "FREE" },
    data: { orderId: order.id, reservedUntil: expiresAt },
  });
  if (count !== option.seqs.length) {
    // Kann unter der Zeilensperre nicht passieren; sonst lieber abbrechen als doppelt vergeben.
    throw new Error("Slots konnten nicht vollständig reserviert werden");
  }
  return { ok: true, orderId: order.id };
}
