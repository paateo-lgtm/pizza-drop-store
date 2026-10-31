"use client";

import { Minus, Plus } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { SlotBand, type SlotBandState } from "@/components/slot-band";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { pizzaCount, toBandState } from "@/lib/booking/display";
import {
  pickupOptions,
  type BookingSlot,
  type PickupOption,
} from "@/lib/domain/booking";
import { formatPrice, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { reserve, type ReserveState } from "./actions";

export type OrderMenuItem = {
  pizzaId: string;
  name: string;
  description: string;
  imageUrl: string | null;
  allergens: string[];
  tags: string[];
  unitPriceCents: number;
  /** Noch verfügbar von dieser Sorte, `null` = ohne Kontingent */
  left: number | null;
};

export function OrderForm({
  dropId,
  menu,
  slots,
  earliestStart,
  maxPerOrder,
  remaining,
  reservationMinutes,
  vatRatePercent,
  closedNote,
}: {
  dropId: string;
  menu: OrderMenuItem[];
  slots: BookingSlot[];
  earliestStart: Date;
  maxPerOrder: number;
  remaining: number;
  reservationMinutes: number;
  vatRatePercent: number;
  /** Gesetzt, wenn gerade nicht bestellt werden kann: Hinweis statt Abholzeit und Kasse */
  closedNote?: ReactNode;
}) {
  const open = !closedNote;
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [startSeq, setStartSeq] = useState<number | null>(null);
  const [result, setResult] = useState<Extract<
    ReserveState,
    { ok: false }
  > | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // Mengen nur für Pizzen, die noch auf der Karte stehen
  const lines = menu
    .map((p) => ({ pizza: p, quantity: quantities[p.pizzaId] ?? 0 }))
    .filter((l) => l.quantity > 0);
  const count = lines.reduce((sum, l) => sum + l.quantity, 0);
  const total = lines.reduce(
    (sum, l) => sum + l.quantity * l.pizza.unitPriceCents,
    0,
  );
  const limit = Math.min(maxPerOrder, remaining);

  const options = pickupOptions(slots, count, earliestStart);
  const selected = options.find((o) => o.startSeq === startSeq) ?? null;
  const errors = result?.fieldErrors ?? {};

  function change(id: string, delta: number) {
    setQuantities((prev) => ({
      ...prev,
      [id]: Math.max(0, (prev[id] ?? 0) + delta),
    }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const data = new FormData(event.currentTarget);
    const payload = {
      dropId,
      startSeq: selected.startSeq,
      items: lines.map((l) => ({
        pizzaId: l.pizza.pizzaId,
        quantity: l.quantity,
      })),
      name: String(data.get("name") ?? ""),
      email: String(data.get("email") ?? ""),
      phone: String(data.get("phone") ?? ""),
      note: String(data.get("note") ?? ""),
      feedbackConsent: data.get("feedbackConsent") === "on",
    };
    startTransition(async () => {
      let state: ReserveState;
      try {
        state = await reserve(payload);
      } catch {
        toast.error(
          "Das hat nicht geklappt. Bitte prüfe deine Verbindung und versuch es noch einmal.",
        );
        return;
      }
      if (state.ok) {
        router.push(state.href);
        return;
      }
      setResult(state);
      // Der Server hat den frischen Stand mitgeschickt; die Auswahl muss neu getroffen werden.
      if (state.conflict) setStartSeq(null);
    });
  }

  const bandStates: SlotBandState[] = slots.map((s) =>
    selected?.seqs.includes(s.seq) ? "selected" : toBandState(s.status),
  );

  return (
    <form
      onSubmit={submit}
      noValidate
      className="grid gap-16 pb-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-20 lg:pb-0"
    >
      <div className="flex min-w-0 flex-col gap-16">
        <section aria-labelledby="karte">
          <StepHeading id="karte" step={1}>
            Pizzen wählen
          </StepHeading>
          <p className="mt-2 text-ink-muted">
            Jede Pizza bekommt ihren eigenen Slot im Ofen. Höchstens{" "}
            {pizzaCount(maxPerOrder)} pro Bestellung.
          </p>
          <ul className="mt-8 divide-y divide-line border-y border-line">
            {menu.map((pizza) => (
              <MenuRow
                key={pizza.pizzaId}
                pizza={pizza}
                quantity={quantities[pizza.pizzaId] ?? 0}
                open={open}
                canAdd={
                  count < limit &&
                  (pizza.left === null ||
                    (quantities[pizza.pizzaId] ?? 0) < pizza.left)
                }
                onChange={(delta) => change(pizza.pizzaId, delta)}
              />
            ))}
          </ul>
        </section>

        {open ? (
          <>
            <section aria-labelledby="abholzeit" className="scroll-mt-6">
              <StepHeading id="abholzeit" step={2}>
                Abholzeit
              </StepHeading>
              <PickupPicker
                count={count}
                options={options}
                selected={selected}
                onSelect={setStartSeq}
              />
            </section>

            <section aria-labelledby="angaben" className="scroll-mt-6">
              <StepHeading id="angaben" step={3}>
                Deine Angaben
              </StepHeading>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <Field label="Name" name="name" error={errors.name}>
                  <Input
                    id="name"
                    name="name"
                    autoComplete="name"
                    required
                    aria-invalid={!!errors.name}
                  />
                </Field>
                <Field label="Telefon" name="phone" error={errors.phone}>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    required
                    aria-invalid={!!errors.phone}
                  />
                </Field>
                <Field
                  label="E-Mail"
                  name="email"
                  error={errors.email}
                  hint="Dorthin schicken wir Bestätigung und Abholcode."
                  className="sm:col-span-2"
                >
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    aria-invalid={!!errors.email}
                  />
                </Field>
                <Field
                  label="Notiz (optional)"
                  name="note"
                  error={errors.note}
                  className="sm:col-span-2"
                >
                  <Textarea id="note" name="note" rows={2} maxLength={300} />
                </Field>
                <div className="flex items-start gap-3 text-sm sm:col-span-2">
                  <Checkbox
                    id="feedbackConsent"
                    name="feedbackConsent"
                    className="mt-0.5"
                  />
                  <label htmlFor="feedbackConsent" className="text-ink-muted">
                    Ich möchte nach der Abholung per E-Mail um eine kurze
                    Bewertung gebeten werden.
                  </label>
                </div>
              </div>
            </section>
          </>
        ) : (
          <div className="border-t border-line pt-8">{closedNote}</div>
        )}
      </div>

      {open && (
        <aside
          aria-labelledby="zusammenfassung"
          className="lg:sticky lg:top-8 lg:self-start"
        >
          <h2 id="zusammenfassung" className="text-3xl">
            Deine Bestellung
          </h2>
          <SlotBand
            states={bandStates}
            label={
              selected
                ? `Gewählt: Slots ${selected.seqs[0]} bis ${selected.seqs.at(-1)}`
                : `${slots.filter((s) => s.status === "free").length} von ${slots.length} Slots frei`
            }
            className="mt-6"
          />
          {slots.length > 0 && (
            <div className="mt-2 flex justify-between text-xs text-ink-muted tabular-nums">
              <span>{formatTime(slots[0].startsAt)}</span>
              <span>{formatTime(slots.at(-1)!.endsAt)}</span>
            </div>
          )}

          <div className="mt-6 border-t border-line pt-6">
            {lines.length > 0 ? (
              <ul className="mb-4 flex flex-col gap-1.5 text-sm">
                {lines.map(({ pizza, quantity }) => (
                  <li key={pizza.pizzaId} className="flex justify-between">
                    <span>
                      {quantity} × {pizza.name}
                    </span>
                    <span className="tabular-nums">
                      {formatPrice(quantity * pizza.unitPriceCents)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-4 text-sm text-ink-muted">
                Noch keine Pizza gewählt.
              </p>
            )}
            <dl className="grid grid-cols-2 gap-y-2 border-t border-line pt-4 text-sm">
              <dt className="text-ink-muted">Abholung</dt>
              <dd className="text-right font-medium text-terracotta tabular-nums">
                {selected ? `${formatTime(selected.pickupAt)} Uhr` : "–"}
              </dd>
              <dt className="text-ink-muted">
                Summe inkl. {vatRatePercent} % MwSt.
              </dt>
              <dd className="text-right text-base font-semibold tabular-nums">
                {formatPrice(total)}
              </dd>
            </dl>

            {result && (
              <p role="alert" className="mt-4 text-sm text-terracotta">
                {result.message}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              className="mt-6 w-full"
              disabled={!selected || pending}
            >
              {pending ? "Wird reserviert …" : "Abholzeit reservieren"}
            </Button>
            <p className="mt-3 text-xs text-ink-muted">
              Deine Slots sind danach {reservationMinutes} Minuten für dich
              reserviert, bis die Zahlung abgeschlossen ist.
            </p>
          </div>
        </aside>
      )}

      {open && count > 0 && (
        <MobileBar count={count} total={total} selected={selected} />
      )}
    </form>
  );
}

function StepHeading({
  id,
  step,
  children,
}: {
  id: string;
  step: number;
  children: ReactNode;
}) {
  return (
    <h2 id={id} className="flex items-baseline gap-3 text-4xl">
      <span className="font-serif text-3xl text-olive italic" aria-hidden>
        {step}
      </span>
      {children}
    </h2>
  );
}

function MenuRow({
  pizza,
  quantity,
  open,
  canAdd,
  onChange,
}: {
  pizza: OrderMenuItem;
  quantity: number;
  open: boolean;
  canAdd: boolean;
  onChange: (delta: number) => void;
}) {
  const soldOut = pizza.left === 0;
  return (
    <li
      className={cn(
        "grid grid-cols-[1fr_auto] items-center gap-4 py-5 sm:grid-cols-[6rem_1fr_auto] sm:gap-6",
        soldOut && "opacity-55",
      )}
    >
      <div className="relative hidden aspect-[4/3] overflow-hidden rounded-md border border-line bg-wash sm:block">
        {pizza.imageUrl ? (
          <Image
            src={pizza.imageUrl}
            alt=""
            fill
            sizes="96px"
            className="object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex h-full items-center justify-center font-serif text-sm text-ink-muted italic"
          >
            {pizza.name.slice(0, 1)}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-2xl">{pizza.name}</h3>
          <span className="tabular-nums">
            {formatPrice(pizza.unitPriceCents)}
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
        {pizza.allergens.length > 0 && (
          <p className="mt-1 text-xs text-ink-muted">
            Allergene: {pizza.allergens.join(", ")}
          </p>
        )}
        {!soldOut && pizza.left !== null && pizza.left <= 5 && (
          <p className="mt-1 text-xs font-medium text-terracotta">
            Nur noch {pizza.left}
          </p>
        )}
      </div>
      {soldOut ? (
        <span className="text-sm font-medium text-terracotta">Ausverkauft</span>
      ) : open ? (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={`Eine ${pizza.name} weniger`}
            disabled={quantity === 0}
            onClick={() => onChange(-1)}
          >
            <Minus />
          </Button>
          <output
            className="w-6 text-center tabular-nums"
            aria-label={`${pizza.name}: Anzahl`}
            aria-live="polite"
          >
            {quantity}
          </output>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={`Eine ${pizza.name} mehr`}
            disabled={!canAdd}
            onClick={() => onChange(1)}
          >
            <Plus />
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function PickupPicker({
  count,
  options,
  selected,
  onSelect,
}: {
  count: number;
  options: PickupOption[];
  selected: PickupOption | null;
  onSelect: (startSeq: number) => void;
}) {
  if (count === 0) {
    return (
      <p className="mt-4 text-ink-muted">
        Wähle zuerst deine Pizzen, dann zeigen wir dir die freien Abholzeiten.
      </p>
    );
  }
  if (options.length === 0) {
    return (
      <p className="mt-4 text-terracotta">
        Für {pizzaCount(count)} sind keine {count} Slots am Stück mehr frei.
        Versuch es mit weniger Pizzen.
      </p>
    );
  }

  // Nach Stunde der Abholzeit gruppiert, damit lange Listen überschaubar bleiben
  const groups = new Map<string, PickupOption[]>();
  for (const option of options) {
    const hour = formatTime(option.pickupAt).slice(0, 2);
    groups.set(hour, [...(groups.get(hour) ?? []), option]);
  }

  return (
    <fieldset className="mt-4">
      <legend className="text-ink-muted">
        Freie Abholzeiten für {pizzaCount(count)}. Wir backen sie direkt
        nacheinander, abgeholt wird, wenn die letzte fertig ist.
      </legend>
      <div className="mt-6 flex flex-col gap-5">
        {[...groups].map(([hour, group]) => (
          <div
            key={hour}
            className="grid grid-cols-[3.5rem_1fr] items-start gap-3"
          >
            <span className="pt-1.5 text-sm text-ink-muted tabular-nums">
              {hour} Uhr
            </span>
            <div className="flex flex-wrap gap-2">
              {group.map((option) => {
                const active = option.startSeq === selected?.startSeq;
                return (
                  <label
                    key={option.startSeq}
                    className={cn(
                      "cursor-pointer rounded-md border border-line bg-surface px-3 py-1.5 text-sm tabular-nums transition-colors hover:border-olive",
                      "has-[input:focus-visible]:ring-[3px] has-[input:focus-visible]:ring-ring/50",
                      active && "border-olive bg-olive text-primary-foreground",
                    )}
                  >
                    <input
                      type="radio"
                      name="pickup"
                      value={option.startSeq}
                      checked={active}
                      onChange={() => onSelect(option.startSeq)}
                      className="sr-only"
                    />
                    {formatTime(option.pickupAt)}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {selected && (
        <p className="mt-6 text-sm" aria-live="polite">
          Abholung{" "}
          <strong className="font-semibold text-terracotta">
            {formatTime(selected.pickupAt)} Uhr
          </strong>
          <span className="text-ink-muted">
            {" "}
            · gebacken {formatTime(selected.bakeStartsAt)}–
            {formatTime(selected.pickupAt)}
          </span>
        </p>
      )}
    </fieldset>
  );
}

function Field({
  label,
  name,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  name: string;
  error?: string[];
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error?.[0] ? (
        <p className="text-sm text-terracotta">{error[0]}</p>
      ) : (
        hint && <p className="text-xs text-ink-muted">{hint}</p>
      )}
    </div>
  );
}

function MobileBar({
  count,
  total,
  selected,
}: {
  count: number;
  total: number;
  selected: PickupOption | null;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <p className="text-sm">
          <span className="font-medium">{pizzaCount(count)}</span>
          <span className="text-ink-muted"> · {formatPrice(total)}</span>
          {selected && (
            <span className="block text-terracotta tabular-nums">
              Abholung {formatTime(selected.pickupAt)} Uhr
            </span>
          )}
        </p>
        <Button asChild size="sm" variant={selected ? "default" : "outline"}>
          <a href={selected ? "#angaben" : "#abholzeit"}>
            {selected ? "Zu deinen Angaben" : "Abholzeit wählen"}
          </a>
        </Button>
      </div>
    </div>
  );
}
