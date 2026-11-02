import type { Kpis, PizzaRow, SalesPoint } from "@/lib/domain/reporting";
import { formatPrice, formatTime } from "@/lib/format";

const percent = new Intl.NumberFormat("de-DE", {
  style: "percent",
  maximumFractionDigits: 1,
});
export const formatPercent = (ratio: number) => percent.format(ratio);

export type Fact = { label: string; value: string | number; hint?: string };

export function FactGrid({ facts }: { facts: Fact[] }) {
  return (
    // Einzelne Kacheln: eine unvollständige letzte Reihe lässt keine Lücke im Raster
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {facts.map((fact) => (
        <div
          key={fact.label}
          className="flex flex-col gap-1 rounded-md border border-line bg-surface p-4"
        >
          <dt className="text-sm text-ink-muted">{fact.label}</dt>
          <dd className="font-serif text-3xl tabular-nums">{fact.value}</dd>
          {fact.hint && <dd className="text-xs text-ink-muted">{fact.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

export function kpiFacts(kpis: Kpis): Fact[] {
  return [
    {
      label: "Umsatz brutto",
      value: formatPrice(kpis.grossCents),
      hint: `netto ${formatPrice(kpis.netCents)}`,
    },
    { label: "Bestellungen", value: kpis.orders, hint: "bezahlt" },
    { label: "Pizzen", value: kpis.pizzas, hint: "ohne Stornos" },
    {
      label: "Ø Bestellwert",
      value: formatPrice(kpis.avgOrderCents),
      hint: "ohne Stornos",
    },
    {
      label: "Stornoquote",
      value: formatPercent(kpis.cancelRate),
      hint: "nach Zahlung storniert",
    },
    {
      label: "Erstattungsquote",
      value: formatPercent(kpis.refundRate),
      hint: "mit Erstattung",
    },
    {
      label: "No-Show-Quote",
      value: formatPercent(kpis.noShowRate),
      hint: "nicht abgeholt",
    },
  ];
}

/** Tabelle mit Balken für die Stückzahl; die Zahlen stehen immer als Text daneben */
export function PizzaTable({ pizzas }: { pizzas: PizzaRow[] }) {
  if (pizzas.length === 0) {
    return <p className="text-sm text-ink-muted">Keine verkauften Pizzen.</p>;
  }
  const max = Math.max(...pizzas.map((p) => p.quantity));
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-ink-muted">
        <tr className="border-b border-line">
          <th className="py-2 font-normal">Pizza</th>
          <th className="hidden w-2/5 py-2 font-normal sm:table-cell">
            <span className="sr-only">Anteil als Balken</span>
          </th>
          <th className="py-2 text-right font-normal">Stück</th>
          <th className="py-2 text-right font-normal">Anteil</th>
          <th className="py-2 text-right font-normal">Umsatz</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {pizzas.map((p) => (
          <tr key={p.name}>
            <td className="py-2 pr-3">{p.name}</td>
            <td className="hidden py-2 pr-3 sm:table-cell" aria-hidden>
              <div
                className="h-2 rounded-r-[4px] bg-olive"
                style={{ width: `${(p.quantity / max) * 100}%` }}
                title={`${p.name}: ${p.quantity} Stück`}
              />
            </td>
            <td className="py-2 text-right tabular-nums">{p.quantity}</td>
            <td className="py-2 text-right tabular-nums">
              {formatPercent(p.share)}
            </td>
            <td className="py-2 text-right tabular-nums">
              {formatPrice(p.revenueCents)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const shortDate = new Intl.DateTimeFormat("de-DE", {
  day: "numeric",
  month: "numeric",
  timeZone: "Europe/Berlin",
});

const W = 600;
const H = 200;
const PAD = { top: 12, right: 12, bottom: 8, left: 44 };

/** Kumulierter Verkauf als Treppenlinie; Kapazität als gestrichelte Bezugslinie */
export function SalesChart({
  points,
  capacity,
}: {
  points: SalesPoint[];
  capacity: number;
}) {
  const start = +points[0].at;
  const end = Math.max(+points[points.length - 1].at, start + 3_600_000);
  const top = Math.max(capacity, points[points.length - 1].pizzas, 1);
  const x = (t: number) =>
    PAD.left + ((t - start) / (end - start)) * (W - PAD.left - PAD.right);
  const y = (v: number) =>
    H - PAD.bottom - (v / top) * (H - PAD.top - PAD.bottom);
  const path = points
    .map((p, i) =>
      i === 0 ? `M${x(+p.at)},${y(p.pizzas)}` : `H${x(+p.at)}V${y(p.pizzas)}`,
    )
    .join("");
  const last = points[points.length - 1];
  // Über mehr als einen Tag reicht die Uhrzeit allein nicht
  const tick = (d: Date) =>
    end - start > 86_400_000
      ? `${shortDate.format(d)} ${formatTime(d)}`
      : formatTime(d);

  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full text-ink-muted"
        role="img"
        aria-label={`Verkaufsverlauf: ${last.pizzas} von ${capacity} Pizzen verkauft`}
      >
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={y(0)}
          y2={y(0)}
          stroke="var(--line)"
          vectorEffect="non-scaling-stroke"
        />
        {capacity > 0 && (
          <>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(capacity)}
              y2={y(capacity)}
              stroke="currentColor"
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={PAD.left - 6}
              y={y(capacity)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize="16"
              fill="currentColor"
            >
              {capacity}
            </text>
          </>
        )}
        <text
          x={PAD.left - 6}
          y={y(0)}
          textAnchor="end"
          dominantBaseline="middle"
          fontSize="16"
          fill="currentColor"
        >
          0
        </text>
        <path
          d={`${path}H${x(end)}`}
          fill="none"
          stroke="var(--olive)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
        {points.slice(1).map((p, i) => (
          <circle
            key={i}
            cx={x(+p.at)}
            cy={y(p.pizzas)}
            r="5"
            fill="var(--olive)"
            stroke="var(--surface)"
            strokeWidth="2"
          >
            <title>{`${formatTime(p.at)} Uhr: ${p.pizzas} verkauft`}</title>
          </circle>
        ))}
      </svg>
      {/* Zeitachse als HTML, damit die Schrift auf dem Handy nicht mitschrumpft */}
      <div
        className="flex justify-between text-xs text-ink-muted tabular-nums"
        style={{ paddingLeft: `${(PAD.left / W) * 100}%` }}
      >
        <span>{tick(new Date(start))}</span>
        <span>{tick(new Date(end))}</span>
      </div>
      <figcaption className="mt-2 text-xs text-ink-muted">
        Kumuliert nach Zahlungszeit, ab Verkaufsstart. Gestrichelt: Kapazität (
        {capacity} Pizzen).
      </figcaption>
      <table className="sr-only">
        <caption>Verkaufsverlauf als Tabelle</caption>
        <thead>
          <tr>
            <th scope="col">Zeit</th>
            <th scope="col">Verkauft (kumuliert)</th>
          </tr>
        </thead>
        <tbody>
          {points.slice(1).map((p, i) => (
            <tr key={i}>
              <td>{tick(p.at)}</td>
              <td>{p.pizzas}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
