/**
 * Ausgabe: Bestellungen an der Theke finden – per Bestellnummer, Abholcode (auch aus dem
 * QR-Code) oder Namen. Reine Funktionen ohne Framework- oder Datenbankbezug (siehe
 * docs/PLAN.md, 1.4).
 */
import { PICKUP_CODE_ALPHABET } from "./booking";
import type { OrderStatus } from "./drops";

export type PickupOrder = {
  id: string;
  number: number;
  customer: string;
  pickupCode: string;
  status: OrderStatus;
  pickupAt: Date;
};

const MIN_NAME_QUERY = 2;

/** Abholbereite zuerst, dann was noch im Ofen ist, Abgeholte zuletzt. */
const RANK: Partial<Record<OrderStatus, number>> = {
  READY: 0,
  IN_PROGRESS: 1,
  PAID: 1,
  PICKED_UP: 2,
};

/** Kleinbuchstaben ohne Akzente: „Müller“ findet man auch mit „muller“. */
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export function findPickupOrders<T extends PickupOrder>(
  orders: readonly T[],
  query: string,
  limit = 6,
): T[] {
  const q = query.trim().replace(/^#/, "").trim();
  if (!q) return [];

  // Erst der Abholcode: Er kann auch nur aus Ziffern bestehen (z. B. „234567“).
  const code = q.toUpperCase();
  let hits = orders.filter((o) => o.pickupCode === code);
  if (hits.length === 0) {
    if (/^\d+$/.test(q)) {
      hits = orders.filter((o) => o.number === Number(q));
    } else {
      const name = normalize(q);
      hits =
        name.length < MIN_NAME_QUERY
          ? []
          : orders.filter((o) => normalize(o.customer).includes(name));
    }
  }

  return hits
    .toSorted(
      (a, b) =>
        (RANK[a.status] ?? 3) - (RANK[b.status] ?? 3) ||
        a.pickupAt.getTime() - b.pickupAt.getTime(),
    )
    .slice(0, limit);
}

const CODE = new RegExp(`^[${PICKUP_CODE_ALPHABET}]{6}$`);

/** Der QR-Code auf der Bestellseite enthält nur den Abholcode; alles andere zählt nicht. */
export function parseScannedCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  return CODE.test(code) ? code : null;
}
