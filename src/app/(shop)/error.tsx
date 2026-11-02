"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** Fehlerseite im Shop: kein Stacktrace, ein Weg zurück und einer zum neu Versuchen. */
export default function ShopError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-10 pb-20 sm:px-8">
      <h1 className="text-4xl leading-tight sm:text-5xl">
        Da ist etwas schiefgegangen.
      </h1>
      <p className="mt-4 text-lg text-ink-muted">
        Bitte versuch es gleich noch einmal. Eine bezahlte Bestellung bleibt
        davon unberührt.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button size="lg" onClick={reset}>
          Noch einmal versuchen
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/">Zur Startseite</Link>
        </Button>
      </div>
    </div>
  );
}
