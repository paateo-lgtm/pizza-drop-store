import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main
      id="inhalt"
      className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-20 sm:px-8"
    >
      <Link href="/" aria-label="Pizza Drop – Startseite">
        <Wordmark />
      </Link>
      <h1 className="mt-10 text-5xl leading-tight">
        Diese Seite gibt es nicht.
      </h1>
      <p className="mt-4 text-lg text-ink-muted">
        Vielleicht ist der Drop vorbei oder der Link hat sich vertippt.
      </p>
      <Button asChild size="lg" className="mt-8 self-start">
        <Link href="/">Zu den Drops</Link>
      </Button>
    </main>
  );
}
