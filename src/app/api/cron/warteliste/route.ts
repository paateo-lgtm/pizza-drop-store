import { runMailCron } from "@/lib/mail/cron-run";
import { sendWaitlistMail } from "@/lib/marketing/alert-mails";
import { sendDueWaitlistNotices } from "@/lib/marketing/waitlist";

/** Genug Zeit für einen Stapel Mails mit Pause dazwischen. */
export const maxDuration = 60;

/**
 * Warteliste: benachrichtigt Wartende, sobald durch Storno oder abgelaufene
 * Reservierungen passende Slots frei sind. Aufruf wie der Drop-Alarm per GitHub Actions.
 */
export function GET(request: Request) {
  return runMailCron(request, "Warteliste", ({ limit, deadline, paced }) =>
    sendDueWaitlistNotices(new Date(), {
      limit,
      deadline,
      sendNotice: (mail) => paced(() => sendWaitlistMail(mail)),
    }),
  );
}
