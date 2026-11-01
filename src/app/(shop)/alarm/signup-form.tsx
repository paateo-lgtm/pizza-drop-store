"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signUpForAlert, type SignupState } from "./actions";

/** Anmeldung zum Drop-Alarm auf der Startseite (Double-Opt-in). */
export function AlarmSignup() {
  const [state, formAction, pending] = useActionState<SignupState, FormData>(
    signUpForAlert,
    null,
  );

  return (
    <form action={formAction} className="mt-6 max-w-xl" noValidate={false}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex-1">
          <span className="sr-only">E-Mail-Adresse</span>
          <Input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="deine@mail.de"
            className="h-12 text-lg"
            aria-describedby="alarm-hinweis"
          />
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
          className="h-12 aria-disabled:opacity-50"
          aria-disabled={pending}
          onClick={(e) => {
            // Doppelklick während des Sendens: kein zweites Absenden
            if (pending) e.preventDefault();
          }}
        >
          {pending ? "Wird gesendet …" : "Drop-Alarm einschalten"}
        </Button>
      </div>
      <p id="alarm-hinweis" className="mt-3 text-sm text-ink-muted">
        Du bekommst erst eine Mail zur Bestätigung. Danach schreiben wir dir
        nur, wenn ein neuer Drop in den Verkauf geht; abmelden geht mit einem
        Klick. Mehr dazu im{" "}
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
