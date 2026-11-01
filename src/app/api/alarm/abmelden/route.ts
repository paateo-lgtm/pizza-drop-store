import { unsubscribe } from "@/lib/marketing/drop-alert";

/**
 * One-Click-Abmeldung aus dem Mailprogramm (RFC 8058, Kopfzeile List-Unsubscribe-Post).
 * Nur POST: Ein GET würde schon durch Link-Vorschauen und Mail-Scanner abmelden.
 */
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("t");
  if (!token || token.length > 100) {
    return new Response("Ungültiger Link", { status: 400 });
  }
  const result = await unsubscribe(token);
  return new Response(result === "unsubscribed" ? "Abgemeldet" : "Unbekannt", {
    status: result === "unsubscribed" ? 200 : 404,
  });
}
