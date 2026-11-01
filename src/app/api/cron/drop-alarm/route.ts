import { isCronAuthorized } from "@/lib/cron";
import { sendAlertMail } from "@/lib/marketing/alert-mails";
import { sendDueDropAlerts, type AlertMail } from "@/lib/marketing/drop-alert";

/** Genug Zeit für einen Stapel Mails mit Pause dazwischen. */
export const maxDuration = 60;

/** Mails pro Lauf; der Rest folgt im nächsten Lauf (alle 5 min). */
const LIMIT = 40;
/** Resend erlaubt 2 Anfragen pro Sekunde. */
const PAUSE_MS = 550;

/**
 * Drop-Alarm zum Verkaufsstart. Aufruf per GitHub Actions (später ggf. Vercel Cron),
 * jeweils mit `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(request: Request) {
  if (
    !isCronAuthorized(
      request.headers.get("authorization"),
      process.env.CRON_SECRET,
    )
  ) {
    return new Response("Nicht erlaubt", { status: 401 });
  }
  const result = await sendDueDropAlerts(new Date(), {
    limit: LIMIT,
    sendAlert: async (mail: AlertMail) => {
      const sent = await sendAlertMail(mail);
      await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
      return sent;
    },
  });
  return Response.json(result);
}
