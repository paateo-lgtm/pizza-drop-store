/**
 * Adresse der Seite für Metadaten, robots.txt und Sitemap. Anders als appUrl() (Links
 * in Mails und zu Stripe) wirft sie nie: Ein Build ohne APP_URL darf nicht scheitern,
 * und Vorschau-Deployments zeigen auf sich selbst.
 */
export function siteUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  if (env.APP_URL) return env.APP_URL.replace(/\/$/, "");
  if (env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  return "http://localhost:3000";
}
