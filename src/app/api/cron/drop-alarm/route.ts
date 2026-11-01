import { runMailCron } from "@/lib/mail/cron-run";
import { sendAlertMail } from "@/lib/marketing/alert-mails";
import { sendDueDropAlerts } from "@/lib/marketing/drop-alert";

/** Genug Zeit für einen Stapel Mails mit Pause dazwischen. */
export const maxDuration = 60;

/**
 * Drop-Alarm zum Verkaufsstart. Aufruf per GitHub Actions (später ggf. Vercel Cron),
 * jeweils mit `Authorization: Bearer <CRON_SECRET>`.
 */
export function GET(request: Request) {
  return runMailCron(request, "Drop-Alarm", ({ limit, deadline, paced }) =>
    sendDueDropAlerts(new Date(), {
      limit,
      deadline,
      sendAlert: (mail) => paced(() => sendAlertMail(mail)),
    }),
  );
}
