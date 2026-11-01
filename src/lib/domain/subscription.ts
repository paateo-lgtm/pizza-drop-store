/**
 * Drop-Alarm: Anmeldung mit Double-Opt-in und Versand zum Verkaufsstart.
 * Reine Funktionen ohne Framework- oder Datenbankbezug (siehe docs/PLAN.md, 1.6).
 */
import { effectiveStatus, type DropStatus, type DropTimes } from "./drops";

export type SubscriberStatus = "PENDING" | "CONFIRMED" | "UNSUBSCRIBED";

export type SubscribeAction = "create" | "resend" | "restart" | "none";

/**
 * Was passiert bei einer Anmeldung? Die Antwort an die Person ist immer dieselbe,
 * damit niemand herausfinden kann, wer schon angemeldet ist.
 */
export function subscribeAction(
  status: SubscriberStatus | null,
): SubscribeAction {
  if (status === null) return "create";
  if (status === "PENDING") return "resend";
  if (status === "UNSUBSCRIBED") return "restart";
  return "none";
}

export function canConfirm(status: SubscriberStatus): boolean {
  return status === "PENDING";
}

/**
 * Höchstens eine Bestätigungsmail pro Adresse und Tag: Sonst ließe sich das Formular
 * nutzen, um fremde Postfächer zu fluten.
 */
export function confirmMailKey(subscriberId: string, now: Date): string {
  return `drop-alarm-bestaetigen:${subscriberId}:${now.toISOString().slice(0, 10)}`;
}

/** Der Alarm geht pro Drop und Abonnent genau einmal hinaus. */
export function alertMailKey(dropId: string, subscriberId: string): string {
  return `drop-alarm:${dropId}:${subscriberId}`;
}

/** Fällig, solange der Drop im Verkauf ist – auch wenn der Admin früh geöffnet hat. */
export function isAlertDue(
  drop: DropTimes & { status: DropStatus },
  now: Date,
): boolean {
  return effectiveStatus(drop, now) === "ON_SALE";
}
