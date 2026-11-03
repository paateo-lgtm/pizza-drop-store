import { withdrawFeedbackConsent } from "@/lib/marketing/feedback";

/**
 * One-Click-Widerspruch gegen Feedback-Anfragen aus dem Mailprogramm (RFC 8058).
 * Nur POST: Ein GET würde schon durch Link-Vorschauen und Mail-Scanner widersprechen.
 */
export async function POST(request: Request) {
  const params = new URL(request.url).searchParams;
  const orderId = params.get("o");
  const key = params.get("k");
  if (!orderId || !key || orderId.length > 100 || key.length > 200) {
    return new Response("Ungültiger Link", { status: 400 });
  }
  const result = await withdrawFeedbackConsent(orderId, key);
  return new Response(result === "withdrawn" ? "Erledigt" : "Unbekannt", {
    status: result === "withdrawn" ? 200 : 404,
  });
}
