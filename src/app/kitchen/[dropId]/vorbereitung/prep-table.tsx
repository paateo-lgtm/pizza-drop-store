"use client";

import { Printer } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { UNIT_LABELS } from "@/lib/constants";
import type { PrepLine, PrepList, Unit } from "@/lib/domain/prep";

const amount = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 });

export function PrintButton() {
  return (
    <Button type="button" variant="outline" onClick={() => window.print()}>
      <Printer aria-hidden /> Drucken
    </Button>
  );
}

// ─── Abhaken: pro Gerät im Browser gespeichert ──────────────────────────────

const CHANGE = "prep-checks";
const storageKey = (dropId: string) => `prep:${dropId}`;

function readChecks(dropId: string): string {
  try {
    return localStorage.getItem(storageKey(dropId)) ?? "[]";
  } catch {
    return "[]";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE, onChange);
  };
}

/** Abgehakte Positionen; der Server kennt sie nicht (alles offen beim ersten Rendern). */
function useChecks(dropId: string) {
  const raw = useSyncExternalStore(
    subscribe,
    () => readChecks(dropId),
    () => "[]",
  );
  let checked: string[];
  try {
    const parsed: unknown = JSON.parse(raw);
    checked = Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    checked = [];
  }
  function toggle(key: string) {
    const next = checked.includes(key)
      ? checked.filter((k) => k !== key)
      : [...checked, key];
    try {
      localStorage.setItem(storageKey(dropId), JSON.stringify(next));
    } catch {
      // Privater Modus o. Ä.: Abhaken geht dann nur auf Papier.
    }
    window.dispatchEvent(new Event(CHANGE));
  }
  return { checked, toggle };
}

// ─── Tabelle ────────────────────────────────────────────────────────────────

type Row = PrepLine & { key: string; label: string; unit: Unit };

export function PrepTable({
  dropId,
  list,
  bufferPercent,
}: {
  dropId: string;
  list: PrepList;
  bufferPercent: number;
}) {
  const { checked, toggle } = useChecks(dropId);

  const sections: { title: string; rows: Row[] }[] = [
    {
      title: "Teig",
      rows: [
        { key: "dough", label: "Teiglinge", unit: "PIECE", ...list.dough },
      ],
    },
    {
      title: "Pizzen",
      rows: list.pizzas.map((p) => ({
        key: `pizza:${p.id}`,
        label: p.name,
        unit: "PIECE",
        ...p,
      })),
    },
    {
      title: "Zutaten",
      rows: list.ingredients.map((i) => ({
        key: `ingredient:${i.id}`,
        label: i.name,
        ...i,
      })),
    },
  ];

  return (
    <div className="mt-8 flex flex-col gap-10 print:mt-4 print:gap-6">
      {sections.map((section) => (
        <section key={section.title} aria-labelledby={`prep-${section.title}`}>
          <h2
            id={`prep-${section.title}`}
            className="font-sans text-sm font-semibold tracking-wide text-olive uppercase"
          >
            {section.title}
          </h2>
          {section.rows.length === 0 ? (
            <p className="mt-2 text-ink-muted">
              Keine Rezepte hinterlegt – Zutaten pflegst du im Admin unter
              „Pizzen“.
            </p>
          ) : (
            <table className="mt-2 w-full border-collapse text-lg tabular-nums print:text-base">
              <thead>
                <tr className="border-b border-line text-left text-sm text-ink-muted">
                  <th scope="col" className="py-2 font-medium">
                    Position
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    Verkauft
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    Bei Ausverkauf
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    Mit Puffer (+{bufferPercent} %)
                  </th>
                </tr>
              </thead>
              <tbody>
                {section.rows.map((row) => {
                  const done = checked.includes(row.key);
                  const unit = UNIT_LABELS[row.unit];
                  return (
                    <tr
                      key={row.key}
                      className={
                        done
                          ? "border-b border-line text-ink-muted line-through"
                          : "border-b border-line"
                      }
                    >
                      <th scope="row" className="py-3 text-left font-normal">
                        <label className="flex cursor-pointer items-center gap-3">
                          <input
                            type="checkbox"
                            checked={done}
                            onChange={() => toggle(row.key)}
                            className="size-6 shrink-0 accent-[var(--olive)]"
                          />
                          {row.label}
                        </label>
                      </th>
                      <td className="py-3 text-right">
                        {amount.format(row.sold)} {unit}
                      </td>
                      <td className="py-3 text-right">
                        {amount.format(row.sellOut)} {unit}
                      </td>
                      <td className="py-3 text-right font-semibold">
                        {amount.format(row.withBuffer)} {unit}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </div>
  );
}
