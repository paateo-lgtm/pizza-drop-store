import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** Gemeinsamer Rahmen für Bestätigen und Abmelden (auch Warteliste): Text und genau ein Knopf. */
export function AlarmPage({
  title,
  text,
  action,
  buttonLabel,
  eyebrow = "Drop-Alarm",
}: {
  eyebrow?: string;
  title: string;
  text: ReactNode;
  /** Ohne Aktion nur die Meldung und der Weg zur Startseite */
  action?: () => Promise<void>;
  buttonLabel?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-10 pb-20 sm:px-8">
      <p className="text-sm font-medium tracking-wide text-terracotta uppercase">
        {eyebrow}
      </p>
      <h1 className="mt-4 text-4xl leading-tight sm:text-5xl">{title}</h1>
      <div className="mt-4 text-lg text-ink-muted">{text}</div>
      {action ? (
        <form action={action} className="mt-8">
          <Button type="submit" size="lg">
            {buttonLabel}
          </Button>
        </form>
      ) : (
        <Button asChild size="lg" variant="outline" className="mt-8">
          <Link href="/">Zur Startseite</Link>
        </Button>
      )}
    </div>
  );
}
