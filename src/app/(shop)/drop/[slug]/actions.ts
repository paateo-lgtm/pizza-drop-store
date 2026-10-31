"use server";

import { refresh } from "next/cache";
import { orderPath } from "@/lib/booking/order-link";
import { reserveOrder, type ReserveResult } from "@/lib/booking/reserve";

export type ReserveState =
  { ok: true; href: string } | Extract<ReserveResult, { ok: false }>;

/**
 * Reserviert die Slots. Die Weiterleitung übernimmt der Client: Ein redirect() hier käme
 * dort als Ausnahme an und ließe sich nicht von echten Verbindungsfehlern unterscheiden.
 */
export async function reserve(input: unknown): Promise<ReserveState> {
  const result = await reserveOrder(input);
  if (result.ok) return { ok: true, href: orderPath(result.orderId) };
  // Frischen Stand mitschicken, damit vergebene Zeiten sofort verschwinden.
  if (result.conflict) refresh();
  return result;
}
