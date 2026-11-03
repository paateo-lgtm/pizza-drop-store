import { isCronAuthorized } from "@/lib/cron";
import { cleanupPersonalData } from "@/lib/maintenance/cleanup";

/**
 * Löscht personenbezogene Daten nach Frist (Versandprotokoll, nie bestätigte Anmeldungen).
 * Aufruf wie die Mail-Crons per GitHub Actions.
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
  return Response.json(await cleanupPersonalData(new Date()));
}
