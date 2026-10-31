/**
 * Buchung: Abholzeiten, Warenkorb, Kontingente, Preise und Abholcode.
 * Reine Funktionen ohne Framework- oder Datenbankbezug (siehe docs/PLAN.md, 3.2).
 */
import type { OrderStatus, SlotStatus } from "./drops";

export type BookingSlot = {
  seq: number;
  startsAt: Date;
  endsAt: Date;
  status: SlotStatus;
};

export type PickupOption = {
  startSeq: number;
  seqs: number[];
  /** Beginn des ersten Slots */
  bakeStartsAt: Date;
  /** Ende des letzten Slots = Abholzeit */
  pickupAt: Date;
};

/**
 * Alle Abholzeiten für `quantity` Pizzen: Folgen von freien Slots mit lückenloser
 * Nummerierung, deren erster Slot frühestens um `earliestStart` beginnt.
 */
export function pickupOptions(
  slots: readonly BookingSlot[],
  quantity: number,
  earliestStart: Date,
): PickupOption[] {
  if (!Number.isInteger(quantity) || quantity < 1) return [];
  const sorted = [...slots].sort((a, b) => a.seq - b.seq);
  const options: PickupOption[] = [];
  let run: BookingSlot[] = [];

  for (const slot of sorted) {
    const bookable =
      slot.status === "free" &&
      slot.startsAt.getTime() >= earliestStart.getTime();
    const continues = run.length > 0 && run.at(-1)!.seq + 1 === slot.seq;
    if (!bookable) {
      run = [];
      continue;
    }
    run = continues ? [...run, slot] : [slot];
    if (run.length >= quantity) {
      const window = run.slice(-quantity);
      options.push({
        startSeq: window[0].seq,
        seqs: window.map((s) => s.seq),
        bakeStartsAt: window[0].startsAt,
        pickupAt: window.at(-1)!.endsAt,
      });
    }
  }
  return options;
}

/** Wie viele Pizzen der Drop noch aufnehmen kann (freie Slots, gedeckelt durch die Obergrenze). */
export function remainingCapacity(
  slots: readonly Pick<BookingSlot, "status">[],
  maxPizzasTotal: number | null,
): number {
  const free = slots.filter((s) => s.status === "free").length;
  if (maxPizzasTotal === null) return free;
  const occupied = slots.filter(
    (s) => s.status === "sold" || s.status === "reserved",
  ).length;
  return Math.max(0, Math.min(free, maxPizzasTotal - occupied));
}

export type CartLine = { pizzaId: string; quantity: number };

export type MenuEntry = {
  pizzaId: string;
  name: string;
  unitPriceCents: number;
  /** Kontingent der Sorte in diesem Drop, `null` = unbegrenzt */
  maxQuantity: number | null;
  /** Bereits verkauft oder reserviert */
  taken: number;
};

export type CartItem = {
  pizzaId: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
};

export type CartCheck =
  | { ok: true; quantity: number; subtotalCents: number; items: CartItem[] }
  | { ok: false; message: string };

const pizzas = (n: number) => (n === 1 ? "1 Pizza" : `${n} Pizzen`);

/** Prüft den Warenkorb gegen Karte, Kontingente und Grenzen; Namen und Preise kommen aus der Karte. */
export function checkCart(
  lines: readonly CartLine[],
  menu: readonly MenuEntry[],
  limits: { maxPerOrder: number; remaining: number },
): CartCheck {
  const merged = new Map<string, number>();
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      return { ok: false, message: "Bitte gültige Mengen wählen." };
    }
    merged.set(line.pizzaId, (merged.get(line.pizzaId) ?? 0) + line.quantity);
  }
  if (merged.size === 0) {
    return { ok: false, message: "Bitte mindestens eine Pizza wählen." };
  }

  const items: CartItem[] = [];
  for (const [pizzaId, quantity] of merged) {
    const entry = menu.find((m) => m.pizzaId === pizzaId);
    if (!entry) {
      return {
        ok: false,
        message: "Eine Pizza ist nicht mehr auf der Karte. Bitte neu wählen.",
      };
    }
    if (entry.maxQuantity !== null) {
      const left = Math.max(0, entry.maxQuantity - entry.taken);
      if (left === 0) {
        return { ok: false, message: `${entry.name} ist ausverkauft.` };
      }
      if (quantity > left) {
        return {
          ok: false,
          message: `Von ${entry.name} ist nur noch ${left} übrig.`,
        };
      }
    }
    items.push({
      pizzaId,
      name: entry.name,
      unitPriceCents: entry.unitPriceCents,
      quantity,
    });
  }

  const quantity = items.reduce((sum, i) => sum + i.quantity, 0);
  if (quantity > limits.maxPerOrder) {
    return {
      ok: false,
      message: `Pro Bestellung sind höchstens ${pizzas(limits.maxPerOrder)} möglich.`,
    };
  }
  if (limits.remaining <= 0) {
    return { ok: false, message: "Dieser Drop ist ausverkauft." };
  }
  if (quantity > limits.remaining) {
    return {
      ok: false,
      message: `Für diesen Drop sind nur noch ${pizzas(limits.remaining)} frei.`,
    };
  }

  const subtotalCents = items.reduce(
    (sum, i) => sum + i.quantity * i.unitPriceCents,
    0,
  );
  return { ok: true, quantity, subtotalCents, items };
}

export type PriceBreakdown = {
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  /** In `totalCents` enthaltene MwSt. */
  vatCents: number;
};

/** Bruttopreise: Die MwSt. ist im Endbetrag enthalten und wird herausgerechnet. */
export function priceBreakdown(
  subtotalCents: number,
  discountCents: number,
  vatRatePercent: number,
): PriceBreakdown {
  const discount = Math.min(Math.max(0, discountCents), subtotalCents);
  const total = subtotalCents - discount;
  return {
    subtotalCents,
    discountCents: discount,
    totalCents: total,
    vatCents: Math.round((total * vatRatePercent) / (100 + vatRatePercent)),
  };
}

const ACTIVE: OrderStatus[] = [
  "PAID",
  "IN_PROGRESS",
  "READY",
  "PICKED_UP",
  "NO_SHOW",
];

/** Belegt eine Bestellung Slots und Kontingente? Offene Zahlungen nur bis zum Ablauf. */
export function isOrderActive(
  status: OrderStatus,
  expiresAt: Date,
  now: Date,
): boolean {
  if (ACTIVE.includes(status)) return true;
  return status === "PENDING_PAYMENT" && expiresAt.getTime() > now.getTime();
}

/** Ohne 0/O, 1/I/L – lässt sich an der Ausgabe gut vorlesen. */
export const PICKUP_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generatePickupCode(
  random: (length: number) => Uint8Array = (length) =>
    crypto.getRandomValues(new Uint8Array(length)),
): string {
  // 31 Zeichen: Bytes ab 248 verwerfen, damit jedes Zeichen gleich wahrscheinlich ist.
  const limit = 256 - (256 % PICKUP_CODE_ALPHABET.length);
  let code = "";
  while (code.length < 6) {
    for (const byte of random(6)) {
      if (byte < limit && code.length < 6) {
        code += PICKUP_CODE_ALPHABET[byte % PICKUP_CODE_ALPHABET.length];
      }
    }
  }
  return code;
}
