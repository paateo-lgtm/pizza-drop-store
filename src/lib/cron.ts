/**
 * Zugang zu den Cron-Endpunkten (/api/cron/*). Aufrufer ist GitHub Actions, später
 * ggf. Vercel Cron – beide schicken `Authorization: Bearer <CRON_SECRET>`.
 */
import { timingSafeEqual } from "node:crypto";

/** Kürzere Schlüssel gelten als nicht eingerichtet. */
const MIN_SECRET_LENGTH = 32;

export function isCronAuthorized(
  header: string | null,
  secret: string | undefined,
): boolean {
  if (!secret || secret.length < MIN_SECRET_LENGTH || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
