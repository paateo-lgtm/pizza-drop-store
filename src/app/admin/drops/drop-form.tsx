"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { describeGrid } from "@/lib/domain/drops";
import { formatDuration, formatPrice, formatTime } from "@/lib/format";
import { parseBerlinLocal } from "@/lib/time";
import { slugify, type FormState } from "@/lib/validation/common";
import { saveDrop } from "./actions";

export type PizzaOption = {
  id: string;
  name: string;
  priceCents: number;
  active: boolean;
};

export type DropFormValues = {
  id: string | null;
  title: string;
  slug: string;
  saleStartsAt: string;
  saleEndsAt: string;
  bakeStartsAt: string;
  bakeEndsAt: string;
  slotSeconds: number;
  maxPizzasTotal: string;
  maxPizzasPerOrder: string;
  location: string;
  notes: string;
  pizzas: { pizzaId: string; price: string; maxQuantity: string }[];
};

export function DropForm({
  initial,
  pizzas,
  gridLocked,
}: {
  initial: DropFormValues;
  pizzas: PizzaOption[];
  /** Ab Verkaufsstart: Backzeitraum und Slotlänge nur noch lesbar */
  gridLocked: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    saveDrop.bind(null, initial.id),
    undefined,
  );
  const [slugTouched, setSlugTouched] = useState(initial.id !== null);
  const [slug, setSlug] = useState(initial.slug);
  const [bakeStartsAt, setBakeStartsAt] = useState(initial.bakeStartsAt);
  const [bakeEndsAt, setBakeEndsAt] = useState(initial.bakeEndsAt);
  const [slotMinutes, setSlotMinutes] = useState(
    String(Math.floor(initial.slotSeconds / 60)),
  );
  const [slotSecondsPart, setSlotSecondsPart] = useState(
    String(initial.slotSeconds % 60),
  );
  const [maxTotal, setMaxTotal] = useState(initial.maxPizzasTotal);
  const [selected, setSelected] = useState(
    () => new Map(initial.pizzas.map((p) => [p.pizzaId, p])),
  );

  const errors = state?.fieldErrors ?? {};
  const slotSeconds = Number(slotMinutes) * 60 + Number(slotSecondsPart);
  const start = parseBerlinLocal(bakeStartsAt);
  const end = parseBerlinLocal(bakeEndsAt);
  const grid =
    start && end && slotSeconds >= 120
      ? describeGrid({
          bakeStartsAt: start,
          bakeEndsAt: end,
          slotSeconds,
          maxPizzasTotal: maxTotal.trim() ? Number(maxTotal) : null,
        })
      : null;

  // Feste Reihenfolge wie in der Pizzenliste; die Indizes der Felder zählen nur die ausgewählten.
  const fieldIndex = new Map(
    pizzas.filter((p) => selected.has(p.id)).map((p, i) => [p.id, i]),
  );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => action(data));
      }}
      className="grid max-w-5xl gap-10 lg:grid-cols-[1fr_18rem]"
    >
      <div className="flex flex-col gap-8">
        <Section title="Grunddaten">
          <Field label="Titel" htmlFor="title" error={errors.title}>
            <Input
              id="title"
              name="title"
              required
              defaultValue={initial.title}
              onChange={(e) => {
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
            />
          </Field>
          <Field
            label="Kurzname in der Adresse"
            htmlFor="slug"
            error={errors.slug}
            hint={`/drop/${slug || "titel"}`}
          >
            <Input
              id="slug"
              name="slug"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
            />
          </Field>
          <Field label="Abholort" htmlFor="location" error={errors.location}>
            <Input
              id="location"
              name="location"
              defaultValue={initial.location}
            />
          </Field>
          <Field
            label="Interne Notiz"
            htmlFor="notes"
            error={errors.notes}
            hint="Nur im Admin-Bereich sichtbar."
          >
            <Textarea
              id="notes"
              name="notes"
              rows={2}
              defaultValue={initial.notes}
            />
          </Field>
        </Section>

        <Section
          title="Backzeitraum & Raster"
          description="Ein Slot ist eine Pizza im Ofen. Abgeholt wird am Ende des letzten Slots einer Bestellung."
        >
          {gridLocked && (
            <p className="flex items-start gap-2 rounded-md bg-wash px-3 py-2 text-sm text-ink-muted">
              <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
              Seit Verkaufsstart fix. Bist du langsamer, sperr in der Übersicht
              einzelne Slots als Puffer.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Backstart"
              htmlFor="bakeStartsAt"
              error={errors.bakeStartsAt}
            >
              <Input
                id="bakeStartsAt"
                name="bakeStartsAt"
                type="datetime-local"
                required
                readOnly={gridLocked}
                value={bakeStartsAt}
                onChange={(e) => setBakeStartsAt(e.target.value)}
              />
            </Field>
            <Field
              label="Backende"
              htmlFor="bakeEndsAt"
              error={errors.bakeEndsAt}
            >
              <Input
                id="bakeEndsAt"
                name="bakeEndsAt"
                type="datetime-local"
                required
                readOnly={gridLocked}
                value={bakeEndsAt}
                onChange={(e) => setBakeEndsAt(e.target.value)}
              />
            </Field>
          </div>
          <Field
            label="Zeit pro Pizza (Slotlänge)"
            htmlFor="slotMinutes"
            error={errors.slotMinutes}
          >
            <div className="flex items-center gap-2">
              <Input
                id="slotMinutes"
                name="slotMinutes"
                type="number"
                min={2}
                max={20}
                required
                readOnly={gridLocked}
                value={slotMinutes}
                onChange={(e) => setSlotMinutes(e.target.value)}
                className="w-20 tabular-nums"
              />
              <span className="text-sm text-ink-muted">min</span>
              <select
                name="slotSecondsPart"
                aria-label="Sekunden"
                value={slotSecondsPart}
                disabled={gridLocked}
                onChange={(e) => setSlotSecondsPart(e.target.value)}
                className="h-9 rounded-md border border-input bg-surface px-2 text-sm tabular-nums focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-70"
              >
                {[0, 15, 30, 45].map((s) => (
                  <option key={s} value={s}>
                    {String(s).padStart(2, "0")}
                  </option>
                ))}
              </select>
              {/* Ein gesperrtes select wird nicht mitgeschickt. */}
              {gridLocked && (
                <input
                  type="hidden"
                  name="slotSecondsPart"
                  value={slotSecondsPart}
                />
              )}
              <span className="text-sm text-ink-muted">s</span>
            </div>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Obergrenze Pizzen (optional)"
              htmlFor="maxPizzasTotal"
              error={errors.maxPizzasTotal}
              hint="Leer = alle Slots verkaufen."
            >
              <Input
                id="maxPizzasTotal"
                name="maxPizzasTotal"
                type="number"
                min={1}
                value={maxTotal}
                onChange={(e) => setMaxTotal(e.target.value)}
                className="w-28 tabular-nums"
              />
            </Field>
            <Field
              label="Max. Pizzen pro Bestellung"
              htmlFor="maxPizzasPerOrder"
              error={errors.maxPizzasPerOrder}
            >
              <Input
                id="maxPizzasPerOrder"
                name="maxPizzasPerOrder"
                type="number"
                min={1}
                max={20}
                required
                defaultValue={initial.maxPizzasPerOrder}
                className="w-28 tabular-nums"
              />
            </Field>
          </div>
        </Section>

        <Section
          title="Pizzen"
          description="Preis leer = Standardpreis der Pizza. Kontingent leer = unbegrenzt bis zur Gesamtkapazität."
        >
          {pizzas.length === 0 ? (
            <p className="text-sm text-ink-muted">
              Noch keine aktiven Pizzen.{" "}
              <Link href="/admin/pizzen/neu" className="text-olive underline">
                Pizza anlegen
              </Link>
            </p>
          ) : (
            <ul className="divide-y divide-line rounded-md border border-line">
              {pizzas.map((pizza) => {
                const row = selected.get(pizza.id);
                const i = fieldIndex.get(pizza.id);
                return (
                  <li
                    key={pizza.id}
                    className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-3 py-2.5 sm:grid-cols-[1fr_7rem_6rem]"
                  >
                    <label className="flex min-w-0 items-center gap-3 text-sm">
                      <Checkbox
                        checked={!!row}
                        onCheckedChange={(checked) =>
                          setSelected((prev) => {
                            const next = new Map(prev);
                            if (checked) {
                              next.set(pizza.id, {
                                pizzaId: pizza.id,
                                price: "",
                                maxQuantity: "",
                              });
                            } else next.delete(pizza.id);
                            return next;
                          })
                        }
                      />
                      <span className="truncate">
                        {pizza.name}
                        {!pizza.active && (
                          <span className="ml-2 text-xs text-ochre">
                            inaktiv
                          </span>
                        )}
                      </span>
                    </label>
                    {row ? (
                      <>
                        <input
                          type="hidden"
                          name={`pizzas.${i}.pizzaId`}
                          value={pizza.id}
                        />
                        <div className="relative">
                          <Input
                            name={`pizzas.${i}.price`}
                            aria-label={`Preis ${pizza.name}`}
                            inputMode="decimal"
                            placeholder={formatPrice(pizza.priceCents).replace(
                              /\s?€/,
                              "",
                            )}
                            defaultValue={row.price}
                            className="pr-7 tabular-nums"
                          />
                          <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-ink-muted">
                            €
                          </span>
                        </div>
                        <Input
                          name={`pizzas.${i}.maxQuantity`}
                          aria-label={`Kontingent ${pizza.name}`}
                          type="number"
                          min={1}
                          placeholder="∞"
                          defaultValue={row.maxQuantity}
                          className="col-start-2 tabular-nums sm:col-start-auto"
                        />
                      </>
                    ) : (
                      <span className="text-right text-sm text-ink-muted tabular-nums sm:col-span-2">
                        {formatPrice(pizza.priceCents)}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {errors.pizzas && <FieldError messages={errors.pizzas} />}
        </Section>

        <Section
          title="Verkaufszeitraum"
          description="Ab Verkaufsstart können Kunden Abholzeiten buchen."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Verkaufsstart"
              htmlFor="saleStartsAt"
              error={errors.saleStartsAt}
            >
              <Input
                id="saleStartsAt"
                name="saleStartsAt"
                type="datetime-local"
                required
                defaultValue={initial.saleStartsAt}
              />
            </Field>
            <Field
              label="Verkaufsende"
              htmlFor="saleEndsAt"
              error={errors.saleEndsAt}
            >
              <Input
                id="saleEndsAt"
                name="saleEndsAt"
                type="datetime-local"
                required
                defaultValue={initial.saleEndsAt}
              />
            </Field>
          </div>
        </Section>
      </div>

      <aside className="flex flex-col gap-8 lg:sticky lg:top-8 lg:self-start">
        <Section title="Vorschau">
          <GridPreview grid={grid} slotSeconds={slotSeconds} start={start} />
        </Section>

        <div className="flex flex-col gap-3">
          {state?.message && (
            <p role="alert" className="text-sm text-terracotta">
              {state.message}
            </p>
          )}
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Speichern …" : "Speichern"}
          </Button>
          <Button variant="ghost" asChild>
            <Link
              href={initial.id ? `/admin/drops/${initial.id}` : "/admin/drops"}
            >
              Abbrechen
            </Link>
          </Button>
        </div>
      </aside>
    </form>
  );
}

function GridPreview({
  grid,
  slotSeconds,
  start,
}: {
  grid: ReturnType<typeof describeGrid>;
  slotSeconds: number;
  start: Date | null;
}) {
  if (!grid || !start) {
    return (
      <p className="text-sm text-ink-muted">
        Backzeitraum und Zeit pro Pizza eingeben, dann erscheint hier das
        Raster.
      </p>
    );
  }
  return (
    <div aria-live="polite" className="flex flex-col gap-3">
      <p className="font-serif text-2xl leading-tight">
        {formatTime(start)}–{formatTime(grid.lastPickupAt)} bei{" "}
        {formatDuration(slotSeconds)} min
      </p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-ink-muted">Slots</dt>
        <dd className="text-right tabular-nums">{grid.slotCount}</dd>
        <dt className="text-ink-muted">Max. Pizzen</dt>
        <dd className="text-right tabular-nums">{grid.capacity}</dd>
        <dt className="text-ink-muted">Erste Abholung</dt>
        <dd className="text-right tabular-nums">
          {formatTime(grid.firstPickupAt)}
        </dd>
        <dt className="text-ink-muted">Letzte Abholung</dt>
        <dd className="text-right tabular-nums">
          {formatTime(grid.lastPickupAt)}
        </dd>
      </dl>
      {grid.unusedSeconds > 0 && (
        <p className="text-xs text-ochre">
          Die letzten {formatDuration(grid.unusedSeconds)} min reichen für keine
          ganze Pizza und bleiben frei.
        </p>
      )}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="border-b border-line pb-2">
        <h2 className="text-2xl">{title}</h2>
        {description && <p className="text-sm text-ink-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string[];
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} className="mb-2">
        {label}
      </Label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
      {error && <FieldError messages={error} />}
    </div>
  );
}

function FieldError({ messages }: { messages: string[] }) {
  return <p className="mt-1 text-sm text-terracotta">{messages[0]}</p>;
}
