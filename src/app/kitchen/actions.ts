"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/dal";
import {
  blockNextSlot,
  finishTicket,
  pickUpOrder,
  startTicket,
  type KitchenResult,
} from "@/lib/kitchen/kitchen";

const id = z.string().min(1).max(40);
const INVALID: KitchenResult = { ok: false, message: "Ungültige Eingabe." };

export async function startTicketAction(ticketId: string) {
  await requireUser("kitchen:use");
  const parsed = id.safeParse(ticketId);
  if (!parsed.success) return INVALID;
  const result = await startTicket(parsed.data);
  refresh();
  return result;
}

export async function finishTicketAction(ticketId: string) {
  await requireUser("kitchen:use");
  const parsed = id.safeParse(ticketId);
  if (!parsed.success) return INVALID;
  const result = await finishTicket(parsed.data);
  refresh();
  return result;
}

export async function pickUpAction(orderId: string) {
  await requireUser("kitchen:use");
  const parsed = id.safeParse(orderId);
  if (!parsed.success) return INVALID;
  const result = await pickUpOrder(parsed.data);
  refresh();
  return result;
}

export async function blockNextSlotAction(dropId: string) {
  const user = await requireUser("kitchen:use");
  const parsed = id.safeParse(dropId);
  if (!parsed.success) return INVALID;
  const result = await blockNextSlot(parsed.data);
  if (result.ok) {
    await audit({
      userId: user.id,
      action: "block",
      entity: "drop",
      entityId: parsed.data,
      diff: { source: "kitchen" },
    });
  }
  refresh();
  return result;
}
