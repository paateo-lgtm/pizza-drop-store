"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Settings } from "@/lib/settings";
import type { FormState } from "@/lib/validation/common";
import { updateSettings } from "./actions";

export function SettingsForm({ settings }: { settings: Settings }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    updateSettings,
    undefined,
  );
  const handled = useRef<FormState>(undefined);
  useEffect(() => {
    if (state?.ok && handled.current !== state) {
      handled.current = state;
      toast.success(state.message);
    }
  }, [state]);

  const errors = state?.fieldErrors ?? {};

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => action(data));
      }}
      className="flex max-w-2xl flex-col gap-10"
    >
      <Group title="Shop">
        <Field id="shopName" label="Name" error={errors.shopName}>
          <Input
            id="shopName"
            name="shopName"
            defaultValue={settings.shopName}
            required
          />
        </Field>
        <Field
          id="contactEmail"
          label="Kontakt-E-Mail"
          error={errors.contactEmail}
        >
          <Input
            id="contactEmail"
            name="contactEmail"
            type="email"
            defaultValue={settings.contactEmail}
          />
        </Field>
        <Field
          id="pickupLocation"
          label="Abholort"
          hint="Standard für neue Drops, z. B. Straße und Hinweis zum Eingang."
          error={errors.pickupLocation}
        >
          <Input
            id="pickupLocation"
            name="pickupLocation"
            defaultValue={settings.pickupLocation}
          />
        </Field>
      </Group>

      <Group
        title="Drops & Küche"
        description="Standardwerte für neue Drops. Laufende Drops behalten ihr Raster."
      >
        <Field
          id="slotMinutes"
          label="Zeit pro Pizza (Slotlänge)"
          hint="Ein Slot = eine Pizza im Ofen."
          error={errors.slotMinutes}
        >
          <div className="flex items-center gap-2">
            <Input
              id="slotMinutes"
              name="slotMinutes"
              type="number"
              min={2}
              max={20}
              defaultValue={Math.floor(settings.defaultSlotSeconds / 60)}
              className="w-20 tabular-nums"
              aria-label="Minuten"
            />
            <span>:</span>
            <select
              name="slotSecondsPart"
              aria-label="Sekunden"
              defaultValue={settings.defaultSlotSeconds % 60}
              className="h-9 w-20 rounded-md border border-input bg-surface px-2 text-sm tabular-nums"
            >
              {[0, 15, 30, 45].map((s) => (
                <option key={s} value={s}>
                  {String(s).padStart(2, "0")}
                </option>
              ))}
            </select>
            <span className="text-sm text-ink-muted">Minuten</span>
          </div>
        </Field>
        <Field
          id="defaultMaxPizzasPerOrder"
          label="Max. Pizzen pro Bestellung"
          error={errors.defaultMaxPizzasPerOrder}
        >
          <Input
            id="defaultMaxPizzasPerOrder"
            name="defaultMaxPizzasPerOrder"
            type="number"
            min={1}
            max={20}
            defaultValue={settings.defaultMaxPizzasPerOrder}
            className="w-24 tabular-nums"
          />
        </Field>
        <Field
          id="reservationMinutes"
          label="Reservierung im Checkout"
          hint="So lange bleiben Slots während der Zahlung für den Kunden reserviert."
          error={errors.reservationMinutes}
        >
          <div className="flex items-center gap-2">
            <Input
              id="reservationMinutes"
              name="reservationMinutes"
              type="number"
              min={5}
              max={30}
              defaultValue={settings.reservationMinutes}
              className="w-24 tabular-nums"
            />
            <span className="text-sm text-ink-muted">Minuten</span>
          </div>
        </Field>
      </Group>

      <Group title="Steuern">
        <Field
          id="vatRatePercent"
          label="MwSt.-Satz"
          hint="Speisen zum Mitnehmen: 7 %. Im Zweifel mit dem Steuerberater klären."
          error={errors.vatRatePercent}
        >
          <div className="flex items-center gap-2">
            <Input
              id="vatRatePercent"
              name="vatRatePercent"
              type="number"
              step="0.1"
              min={0}
              max={25}
              defaultValue={settings.vatRatePercent}
              className="w-24 tabular-nums"
            />
            <span className="text-sm text-ink-muted">%</span>
          </div>
        </Field>
      </Group>

      <Group title="Küche">
        <Field
          id="prepBufferPercent"
          label="Puffer in der Vorbereitungsliste"
          hint="Aufschlag auf die Mengen bei Ausverkauf, z. B. für Ausschuss beim Teig."
          error={errors.prepBufferPercent}
        >
          <div className="flex items-center gap-2">
            <Input
              id="prepBufferPercent"
              name="prepBufferPercent"
              type="number"
              step="1"
              min={0}
              max={100}
              defaultValue={settings.prepBufferPercent}
              className="w-24 tabular-nums"
            />
            <span className="text-sm text-ink-muted">%</span>
          </div>
        </Field>
      </Group>

      <div className="flex items-center gap-4">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Speichern …" : "Speichern"}
        </Button>
        {state?.ok === false && state.message && (
          <p role="alert" className="text-sm text-terracotta">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}

function Group({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5">
      <div className="border-b border-line pb-2">
        <h2 className="text-2xl">{title}</h2>
        {description && <p className="text-sm text-ink-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string[];
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id} className="mb-2">
        {label}
      </Label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
      {error && <p className="mt-1 text-sm text-terracotta">{error[0]}</p>}
    </div>
  );
}
