"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatLongDate } from "@/lib/format";
import type { FormState } from "@/lib/validation/common";
import { saveCoupon } from "./actions";
import type { DropOption } from "./data";

export type CouponFormValues = {
  id: string | null;
  code: string;
  type: "PERCENT" | "FIXED";
  /** Prozent oder Euro wie im Eingabefeld */
  value: string;
  validFrom: string;
  validTo: string;
  maxRedemptions: string;
  maxPerCustomer: string;
  active: boolean;
  dropIds: string[];
};

const selectClass =
  "h-9 w-full rounded-md border border-input bg-surface px-3 text-sm focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none";

export function CouponForm({
  initial,
  drops,
}: {
  initial: CouponFormValues;
  drops: DropOption[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    saveCoupon.bind(null, initial.id),
    undefined,
  );
  const [type, setType] = useState(initial.type);
  const errors = state?.fieldErrors ?? {};
  const selected = new Set(initial.dropIds);

  return (
    <form
      // Über onSubmit statt action={…}: React würde das Formular sonst nach jedem
      // Absenden zurücksetzen, auch wenn der Server Feldfehler meldet.
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => action(data));
      }}
      className="grid max-w-5xl gap-10 lg:grid-cols-[1fr_18rem]"
    >
      <div className="flex flex-col gap-8">
        <Section title="Rabatt">
          <Field
            label="Code"
            htmlFor="code"
            error={errors.code}
            hint="Buchstaben, Ziffern, Bindestrich. Groß-/Kleinschreibung egal."
          >
            <Input
              id="code"
              name="code"
              required
              defaultValue={initial.code}
              autoComplete="off"
              spellCheck={false}
              className="font-mono uppercase"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Art" htmlFor="type" error={errors.type}>
              <select
                id="type"
                name="type"
                value={type}
                onChange={(e) => setType(e.target.value as typeof type)}
                className={selectClass}
              >
                <option value="PERCENT">Prozent</option>
                <option value="FIXED">Fester Betrag</option>
              </select>
            </Field>
            <Field
              label={type === "PERCENT" ? "Rabatt in %" : "Rabatt in €"}
              htmlFor="value"
              error={errors.value}
            >
              <Input
                id="value"
                name="value"
                required
                inputMode={type === "PERCENT" ? "numeric" : "decimal"}
                defaultValue={initial.value}
                placeholder={type === "PERCENT" ? "10" : "5,00"}
                className="tabular-nums"
              />
            </Field>
          </div>
        </Section>

        <Section
          title="Gültigkeit"
          description="Leere Felder bedeuten: keine Einschränkung."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Gültig ab"
              htmlFor="validFrom"
              error={errors.validFrom}
            >
              <Input
                id="validFrom"
                name="validFrom"
                type="datetime-local"
                defaultValue={initial.validFrom}
              />
            </Field>
            <Field label="Gültig bis" htmlFor="validTo" error={errors.validTo}>
              <Input
                id="validTo"
                name="validTo"
                type="datetime-local"
                defaultValue={initial.validTo}
              />
            </Field>
            <Field
              label="Einlösungen insgesamt"
              htmlFor="maxRedemptions"
              error={errors.maxRedemptions}
            >
              <Input
                id="maxRedemptions"
                name="maxRedemptions"
                inputMode="numeric"
                defaultValue={initial.maxRedemptions}
                placeholder="unbegrenzt"
              />
            </Field>
            <Field
              label="Einlösungen pro Kunde"
              htmlFor="maxPerCustomer"
              error={errors.maxPerCustomer}
              hint="Gezählt pro E-Mail-Adresse."
            >
              <Input
                id="maxPerCustomer"
                name="maxPerCustomer"
                inputMode="numeric"
                defaultValue={initial.maxPerCustomer}
                placeholder="unbegrenzt"
              />
            </Field>
          </div>
        </Section>

        <Section
          title="Drops"
          description="Ohne Auswahl gilt der Gutschein für alle Drops."
        >
          {drops.length === 0 ? (
            <p className="text-sm text-ink-muted">Keine Drops geplant.</p>
          ) : (
            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">Gilt nur für diese Drops</legend>
              {drops.map((drop) => (
                <label
                  key={drop.id}
                  className="flex items-center gap-3 text-sm"
                >
                  <Checkbox
                    name="dropIds"
                    value={drop.id}
                    defaultChecked={selected.has(drop.id)}
                  />
                  <span>
                    {drop.title}
                    <span className="text-ink-muted">
                      {" "}
                      · {formatLongDate(drop.bakeStartsAt)}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          {errors.dropIds && (
            <p className="text-sm text-terracotta">{errors.dropIds[0]}</p>
          )}
        </Section>
      </div>

      <aside className="flex flex-col gap-8">
        <Section title="Status">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>
              Aktiv
              <span className="block text-xs text-ink-muted">
                Inaktive Codes lassen sich nicht einlösen.
              </span>
            </span>
            <Switch name="active" defaultChecked={initial.active} />
          </label>
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
            <Link href="/admin/gutscheine">Abbrechen</Link>
          </Button>
        </div>
      </aside>
    </form>
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
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string[];
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={htmlFor} className="mb-2">
        {label}
      </Label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
      {error && <p className="mt-1 text-sm text-terracotta">{error[0]}</p>}
    </div>
  );
}
