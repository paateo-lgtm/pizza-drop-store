import { runMailCron } from "@/lib/mail/cron-run";
import { sendFeedbackMail } from "@/lib/marketing/alert-mails";
import { sendDueFeedbackRequests } from "@/lib/marketing/feedback";

/** Genug Zeit für einen Stapel Mails mit Pause dazwischen. */
export const maxDuration = 60;

/**
 * Feedback-Anfragen einige Stunden nach der Abholung, nur mit Einwilligung. Aufruf wie
 * der Drop-Alarm per GitHub Actions.
 */
export function GET(request: Request) {
  return runMailCron(request, "Feedback", ({ limit, deadline, paced }) =>
    sendDueFeedbackRequests(new Date(), {
      limit,
      deadline,
      sendRequest: (mail) => paced(() => sendFeedbackMail(mail)),
    }),
  );
}
