"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pizzaCount } from "@/lib/booking/display";
import {
  joinWaitlistAction,
  type WaitlistState,
} from "../../warteliste/actions";

/** Eintrag auf die Warteliste, wenn ein Drop ausverkauft ist. */
export function WaitlistForm({
  dropId,
  maxPerOrder,
}: {
  dropId: string;
  maxPerOrder: number;
}) {
  const [state, formAction, pending] = useActionState<WaitlistState, FormData>(
    joinWaitlistAction,
    null,
  );

  return (
    <form
      action={formAction}
      aria-labelledby="warteliste"
      className="mt-8 max-w-2xl"
    >
      <h3 id="warteliste" className="text-2xl">
        Auf die Warteliste
      </h3>
      <input type="hidden" name="dropId" value={dropId} />
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-sm font-medium">E-Mail-Adresse</span>
          <Input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="deine@mail.de"
            className="h-11"
            aria-describedby="warteliste-hinweis"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Anzahl</span>
          <select
            name="quantity"
            defaultValue={1}
            className="h-11 rounded-md border border-input bg-surface px-3 tabular-nums focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {Array.from({ length: maxPerOrder }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {pizzaCount(n)}
              </option>
            ))}
          </select>
        </label>
        {/* Für Bots: nicht sichtbar, nicht per Tab erreichbar */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
          className="hidden"
        />
        <Button
          type="submit"
          size="lg"
          className="h-11 aria-disabled:opacity-50"
          aria-disabled={pending}
          onClick={(e) => {
            // Doppelklick während des Sendens: kein zweites Absenden
            if (pending) e.preventDefault();
          }}
        >
          {pending ? "Wird gesendet …" : "Eintragen"}
        </Button>
      </div>
      <p id="warteliste-hinweis" className="mt-3 text-sm text-ink-muted">
        Wir schreiben dir höchstens einmal, sobald genug Slots am Stück frei
        sind, und löschen den Eintrag nach dem Drop. Austragen geht über den
        Link in der Mail. Mehr dazu im{" "}
        <Link href="/datenschutz" className="underline underline-offset-4">
          Datenschutz
        </Link>
        .
      </p>
      <p role="status" className="mt-3 text-olive">
        {state?.ok ? state.message : null}
      </p>
      <p role="alert" className="mt-3 text-terracotta">
        {state?.ok === false ? `Fehler: ${state.message}` : null}
      </p>
    </form>
  );
}
