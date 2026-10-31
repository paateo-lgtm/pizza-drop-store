import { TZDate } from "@date-fns/tz";
import { addDays } from "date-fns";

/** Alle Zeiten im Shop gelten in Berliner Ortszeit; gespeichert wird UTC. */
export const TIME_ZONE = "Europe/Berlin";

const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** Wert eines `<input type="datetime-local">` ("2026-11-06T17:00") als Berliner Zeit lesen. */
export function parseBerlinLocal(value: string): Date | null {
  const match = LOCAL_INPUT.exec(value.trim());
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const date = new TZDate(year, month - 1, day, hour, minute, TIME_ZONE);
  // Überläufe wie der 30. Februar oder Monat 13 fallen beim Zurücklesen auf.
  if (toBerlinLocalInput(date) !== value.trim()) return null;
  return new Date(date.getTime());
}

/** Zeitpunkt als Wert für `<input type="datetime-local">` in Berliner Zeit. */
export function toBerlinLocalInput(date: Date): string {
  const local = new TZDate(date, TIME_ZONE);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}T${pad(local.getHours())}:${pad(local.getMinutes())}`;
}

/** Um ganze Kalendertage verschieben; die Berliner Uhrzeit bleibt auch über die Zeitumstellung gleich. */
export function shiftBerlinDays(date: Date, days: number): Date {
  return new Date(addDays(new TZDate(date, TIME_ZONE), days).getTime());
}
