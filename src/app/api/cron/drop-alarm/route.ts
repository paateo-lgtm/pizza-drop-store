import { isCronAuthorized } from "@/lib/cron";
import { sendAlertMail } from "@/lib/marketing/alert-mails";
import { sendDueDropAlerts, type AlertMail } from "@/lib/marketing/drop-alert";

/** Genug Zeit für einen Stapel Mails mit Pause dazwischen. */
export const maxDuration = 60;

/** Versuche pro Lauf; der Rest folgt im nächsten Lauf (alle 5 min). */
const LIMIT = 40;
/** Resend erlaubt 2 Anfragen pro Sekunde – auch nach Fehlern Pause machen. */
const PAUSE_MS = 550;
/** Rechtzeitig vor maxDuration aufhören, statt mitten im Versand abgebrochen zu werden. */
const BUDGET_MS = 45_000;

/**
 * Drop-Alarm zum Verkaufsstart. Aufruf per GitHub Actions (später ggf. Vercel Cron),
 * jeweils mit `Authorization: Bearer <CRON_SECRET>`.
 *
 * Antwortet mit 503, wenn Mails übersprungen wurden (RESEND_API_KEY fehlt) oder nur
 * Fehler kamen – dann wird der Lauf in GitHub rot und fällt auf.
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
  const run = await sendDueDropAlerts(new Date(), {
    limit: LIMIT,
    deadline: Date.now() + BUDGET_MS,
    sendAlert: async (mail: AlertMail) => {
      try {
        return await sendAlertMail(mail);
      } finally {
        await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
      }
    },
  });
  const broken = run.skipped > 0 || (run.failed > 0 && run.sent === 0);
  if (broken) {
    console.error("Drop-Alarm: Versand gestört", run);
  }
  return Response.json(run, { status: broken ? 503 : 200 });
}
