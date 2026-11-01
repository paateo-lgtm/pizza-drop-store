/**
 * Warteliste gegen die Datenbank: Eintragen bei ausverkauftem Drop, Austragen und die
 * Benachrichtigung, sobald passende Slots frei werden (siehe docs/PLAN.md, 1.6).
 */
import "server-only";
import type { MailResult } from "@/lib/mail/send";
import type { AlertRun } from "./drop-alert";

export type WaitlistNotice = {
  to: string;
  dedupeKey: string;
  entryId: string;
  dropSlug: string;
  dropTitle: string;
  quantity: number;
  bakeStartsAt: Date;
  saleEndsAt: Date;
  leaveToken: string;
};

export const NOTICE_HEAD_START_MINUTES = 15;

export async function joinWaitlist(
  _input: { dropId: string; email: string; quantity: number },
  _now = new Date(),
): Promise<"joined" | "closed" | "invalid"> {
  throw new Error("noch nicht umgesetzt");
}

export async function leaveWaitlist(
  _token: string,
): Promise<"left" | "invalid"> {
  throw new Error("noch nicht umgesetzt");
}

export async function sendDueWaitlistNotices(
  _now: Date,
  _deps: {
    sendNotice: (mail: WaitlistNotice) => Promise<MailResult>;
    limit: number;
    deadline?: number;
  },
): Promise<AlertRun> {
  throw new Error("noch nicht umgesetzt");
}
