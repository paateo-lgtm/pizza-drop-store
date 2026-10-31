const TIME_ZONE = "Europe/Berlin";

const euro = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

const time = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

const longDate = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: TIME_ZONE,
});

export const formatPrice = (cents: number) => euro.format(cents / 100);
export const formatTime = (date: Date) => time.format(date);
export const formatLongDate = (date: Date) => longDate.format(date);

/** Sekunden als m:ss, z. B. 330 → "5:30"; negative Werte mit Minus. */
export function formatDuration(totalSeconds: number) {
  const sign = totalSeconds < 0 ? "−" : "";
  const abs = Math.abs(Math.round(totalSeconds));
  const minutes = Math.floor(abs / 60);
  const seconds = String(abs % 60).padStart(2, "0");
  return `${sign}${minutes}:${seconds}`;
}
