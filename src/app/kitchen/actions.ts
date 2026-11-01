"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import {
  blockNextSlot,
  finishTicket,
  loadKitchenBoard,
  pickUpOrder,
  startTicket,
  type KitchenBoard,
  type KitchenResult,
} from "@/lib/kitchen/kitchen";

export type KitchenActionResult =
  KitchenResult | { ok: false; message: string; signIn: true };

const id = z.string().min(1).max(40);
const INVALID: KitchenResult = { ok: false, message: "Ungültige Eingabe." };
/**
 * Abgelaufene Sitzung mitten in der Schicht: als Ergebnis melden statt umzuleiten –
 * eine Weiterleitung aus der Aktion käme im Board als „Keine Verbindung“ an.
 */
const SIGN_IN: KitchenActionResult = {
  ok: false,
  message: "Sitzung abgelaufen – bitte neu anmelden.",
  signIn: true,
};

async function kitchenUser() {
  const user = await getCurrentUser();
  return user && can(user.role, "kitchen:use") ? user : null;
}

/** Gemeinsamer Rahmen: Berechtigung, Eingabe prüfen, ausführen, Board neu laden. */
async function kitchenAction(
  rawId: string,
  run: (id: string, userId: string) => Promise<KitchenResult>,
): Promise<KitchenActionResult> {
  const user = await kitchenUser();
  if (!user) return SIGN_IN;
  const parsed = id.safeParse(rawId);
  if (!parsed.success) return INVALID;
  const result = await run(parsed.data, user.id);
  refresh();
  return result;
}

/**
 * Polling des Boards. Bewusst eine Aktion statt router.refresh(): Scheitert der Abruf
 * (WLAN weg), fängt das Board den Fehler und zeigt den letzten Stand mit Warnung –
 * router.refresh() würde stattdessen hart neu laden und auf der Fehlerseite landen.
 */
export async function loadBoardAction(
  dropId: string,
): Promise<KitchenBoard | "signIn" | null> {
  if (!(await kitchenUser())) return "signIn";
  const parsed = id.safeParse(dropId);
  return parsed.success ? loadKitchenBoard(parsed.data) : null;
}

export async function startTicketAction(ticketId: string) {
  return kitchenAction(ticketId, startTicket);
}

export async function finishTicketAction(ticketId: string) {
  return kitchenAction(ticketId, finishTicket);
}

export async function pickUpAction(orderId: string) {
  return kitchenAction(orderId, pickUpOrder);
}

export async function blockNextSlotAction(dropId: string) {
  return kitchenAction(dropId, async (parsedId, userId) => {
    const result = await blockNextSlot(parsedId);
    if (result.ok) {
      // audit() fängt eigene Fehler ab; die Sperre bleibt in jedem Fall bestehen.
      await audit({
        userId,
        action: "block",
        entity: "drop",
        entityId: parsedId,
        diff: { source: "kitchen" },
      });
    }
    return result;
  });
}
