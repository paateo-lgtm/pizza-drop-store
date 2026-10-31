"use client";

import { Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { SlotBand, type SlotBandState } from "@/components/slot-band";
import { Button } from "@/components/ui/button";
import { findConsecutiveStarts } from "@/lib/domain/slots";
import { formatPrice, formatTime } from "@/lib/format";
import type { PreviewPizza, PreviewSlotState } from "@/lib/mock/preview";
import { cn } from "@/lib/utils";

type Slot = {
  seq: number;
  startsAt: Date;
  endsAt: Date;
  state: PreviewSlotState;
};

export function OrderDraft({
  pizzas,
  slots,
  maxPerOrder,
}: {
  pizzas: PreviewPizza[];
  slots: Slot[];
  maxPerOrder: number;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [start, setStart] = useState<number | null>(null);

  const count = Object.values(quantities).reduce((sum, q) => sum + q, 0);
  const total = pizzas.reduce(
    (sum, p) => sum + (quantities[p.id] ?? 0) * p.priceCents,
    0,
  );

  const starts = useMemo(
    () =>
      count === 0
        ? []
        : findConsecutiveStarts(
            slots.map((s) => s.state === "free"),
            count,
          ),
    [slots, count],
  );
  const selectedStart = start !== null && starts.includes(start) ? start : null;

  function change(id: string, delta: number) {
    setQuantities((prev) => {
      const next = Math.max(0, (prev[id] ?? 0) + delta);
      return { ...prev, [id]: next };
    });
  }

  const bandStates: SlotBandState[] = slots.map((s, i) =>
    selectedStart !== null && i >= selectedStart && i < selectedStart + count
      ? "selected"
      : s.state,
  );
  const pickup =
    selectedStart !== null ? slots[selectedStart + count - 1].endsAt : null;

  return (
    <div className="grid gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-20">
      <section aria-labelledby="karte">
        <h2 id="karte" className="text-4xl">
          Die Karte
        </h2>
        <p className="mt-2 text-ink-muted">
          Jede Pizza bekommt ihren eigenen Slot im Ofen. Maximal {maxPerOrder}{" "}
          pro Bestellung.
        </p>
        <ul className="mt-8 divide-y divide-line border-y border-line">
          {pizzas.map((pizza) => {
            const quantity = quantities[pizza.id] ?? 0;
            return (
              <li
                key={pizza.id}
                className={cn(
                  "grid grid-cols-[1fr_auto] items-center gap-4 py-5 sm:grid-cols-[6rem_1fr_auto] sm:gap-6",
                  pizza.soldOut && "opacity-55",
                )}
              >
                <div
                  aria-hidden
                  className="hidden aspect-[4/3] items-center justify-center rounded-md border border-line bg-wash sm:flex"
                >
                  <span className="font-serif text-sm text-ink-muted italic">
                    {pizza.name.slice(0, 1)}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3 className="text-2xl">{pizza.name}</h3>
                    <span className="tabular-nums">
                      {formatPrice(pizza.priceCents)}
                    </span>
                    {pizza.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-sm bg-olive-soft px-1.5 py-0.5 text-xs text-olive-deep"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1 text-sm text-ink-muted sm:text-base">
                    {pizza.description}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    Allergene: {pizza.allergens.join(", ")}
                  </p>
                </div>
                {pizza.soldOut ? (
                  <span className="text-sm font-medium text-terracotta">
                    Ausverkauft
                  </span>
                ) : (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={`${pizza.name} entfernen`}
                      disabled={quantity === 0}
                      onClick={() => change(pizza.id, -1)}
                    >
                      <Minus />
                    </Button>
                    <span
                      className="w-6 text-center tabular-nums"
                      aria-live="polite"
                    >
                      {quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={`${pizza.name} hinzufügen`}
                      disabled={count >= maxPerOrder}
                      onClick={() => change(pizza.id, 1)}
                    >
                      <Plus />
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section
        aria-labelledby="abholzeit"
        className="lg:sticky lg:top-8 lg:self-start"
      >
        <h2 id="abholzeit" className="text-4xl">
          Abholzeit
        </h2>
        <SlotBand
          states={bandStates}
          label={`${slots.filter((s) => s.state === "free").length} von ${slots.length} Slots frei`}
          className="mt-6"
        />
        <div className="mt-2 flex justify-between text-xs text-ink-muted tabular-nums">
          <span>{formatTime(slots[0].startsAt)}</span>
          <span>{formatTime(slots.at(-1)!.endsAt)}</span>
        </div>

        {count === 0 ? (
          <p className="mt-6 text-ink-muted">
            Wähle zuerst deine Pizzen, dann zeigen wir dir die freien
            Abholzeiten.
          </p>
        ) : starts.length === 0 ? (
          <p className="mt-6 text-terracotta">
            Für {count} Pizzen sind keine {count} Slots am Stück mehr frei.
            Versuch es mit weniger Pizzen.
          </p>
        ) : (
          <fieldset className="mt-6">
            <legend className="text-sm font-medium">
              Freie Abholzeiten für {count} {count === 1 ? "Pizza" : "Pizzen"}
            </legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {starts.map((i) => {
                const at = slots[i + count - 1].endsAt;
                const active = i === selectedStart;
                return (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setStart(i)}
                    className={cn(
                      "rounded-md border border-line px-3 py-1.5 text-sm tabular-nums transition-colors hover:border-olive",
                      active && "border-olive bg-olive text-primary-foreground",
                    )}
                  >
                    {formatTime(at)}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        <div className="mt-8 border-t border-line pt-6">
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-ink-muted">Pizzen</dt>
            <dd className="text-right tabular-nums">{count}</dd>
            <dt className="text-ink-muted">Abholung</dt>
            <dd className="text-right font-medium text-terracotta tabular-nums">
              {pickup ? `${formatTime(pickup)} Uhr` : "–"}
            </dd>
            <dt className="text-ink-muted">Summe inkl. 7 % MwSt.</dt>
            <dd className="text-right text-base font-semibold tabular-nums">
              {formatPrice(total)}
            </dd>
          </dl>
          <Button size="lg" className="mt-6 w-full" disabled={pickup === null}>
            Weiter zur Zahlung
          </Button>
          <p className="mt-3 text-xs text-ink-muted">
            Deine Slots sind 10 Minuten für dich reserviert, sobald du zur
            Zahlung gehst.
          </p>
        </div>
      </section>
    </div>
  );
}
