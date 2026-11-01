import "server-only";
import { isCronAuthorized } from "@/lib/cron";
import type { AlertRun } from "@/lib/marketing/drop-alert";

/** Versuche pro Lauf; der Rest folgt im nächsten Lauf (alle 5 min). */
const LIMIT = 40;
/** Resend erlaubt 2 Anfragen pro Sekunde – auch nach Fehlern Pause machen. */
const PAUSE_MS = 550;
/** Rechtzeitig vor maxDuration (60 s) aufhören, statt mitten im Versand abgebrochen zu werden. */
const BUDGET_MS = 45_000;

/**
 * Gemeinsamer Ablauf der Mail-Crons (Drop-Alarm, Warteliste): Zugang prüfen, Mails mit
 * Pause verschicken, Ergebnis melden. Antwortet mit 503, wenn Mails übersprungen wurden
 * (RESEND_API_KEY fehlt) oder nur Fehler kamen – dann wird der Lauf in GitHub rot.
 */
export async function runMailCron(
  request: Request,
  label: string,
  job: (deps: {
    limit: number;
    deadline: number;
    /** Versand mit anschließender Pause */
    paced: <T>(send: () => Promise<T>) => Promise<T>;
  }) => Promise<AlertRun>,
): Promise<Response> {
  if (
    !isCronAuthorized(
      request.headers.get("authorization"),
      process.env.CRON_SECRET,
    )
  ) {
    return new Response("Nicht erlaubt", { status: 401 });
  }
  const run = await job({
    limit: LIMIT,
    deadline: Date.now() + BUDGET_MS,
    paced: async (send) => {
      try {
        return await send();
      } finally {
        await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
      }
    },
  });
  const broken = run.skipped > 0 || (run.failed > 0 && run.sent === 0);
  if (broken) {
    console.error(`${label}: Versand gestört`, run);
  }
  return Response.json(run, { status: broken ? 503 : 200 });
}
