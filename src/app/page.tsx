import { Bell, MapPin } from "lucide-react";
import Link from "next/link";
import { OrderDraft } from "@/app/_components/order-draft";
import { Wordmark } from "@/components/brand/wordmark";
import { SlotBand } from "@/components/slot-band";
import { Button } from "@/components/ui/button";
import { formatLongDate, formatTime } from "@/lib/format";
import { previewDrop, previewPizzas, previewSlots } from "@/lib/mock/preview";

// Design-Entwurf (Phase 0) mit Beispieldaten – ab Phase 3 aus der Datenbank.
export default function Home() {
  const free = previewSlots.filter((s) => s.state === "free").length;
  const total = previewSlots.length;

  return (
    <>
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6 sm:px-8">
        <Wordmark />
        <nav className="flex items-center gap-6 text-sm">
          <Link href="#so-gehts" className="hidden hover:text-olive sm:inline">
            So funktioniert&apos;s
          </Link>
          <Link href="#alarm" className="hidden hover:text-olive sm:inline">
            Drop-Alarm
          </Link>
          <Button asChild size="sm">
            <Link href="#bestellen">Bestellen</Link>
          </Button>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto w-full max-w-6xl px-4 pt-10 pb-16 sm:px-8 sm:pt-16">
          <p className="text-sm font-medium tracking-wide text-terracotta uppercase">
            Nächster Drop · {formatLongDate(previewDrop.bakeStartsAt)}
          </p>
          <h1 className="mt-4 text-5xl leading-[1.05] sm:text-7xl">
            <span className="lining-nums tabular-nums">
              {formatTime(previewDrop.bakeStartsAt)}–
              {formatTime(previewDrop.bakeEndsAt)}
            </span>{" "}
            <span className="text-ink-muted italic">Uhr</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-ink-muted">
            {total} Pizzen, eine nach der anderen aus dem Ofen, alle{" "}
            {previewDrop.slotSeconds / 60} Minuten eine. Du wählst deine
            Abholzeit, wir backen genau dafür.
          </p>

          <div className="mt-10 max-w-3xl">
            <SlotBand
              size="lg"
              states={previewSlots.map((s) => s.state)}
              label={`${free} von ${total} Pizzen noch frei`}
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
              <span>
                <strong className="font-semibold tabular-nums">{free}</strong>{" "}
                <span className="text-ink-muted">von {total} noch frei</span>
              </span>
              <span className="flex items-center gap-1.5 text-ink-muted">
                <MapPin className="size-4" aria-hidden />
                {previewDrop.location}
              </span>
            </div>
          </div>

          <Button asChild size="lg" className="mt-10">
            <Link href="#bestellen">Abholzeit sichern</Link>
          </Button>
        </section>

        <section
          id="bestellen"
          className="scroll-mt-4 border-y border-line bg-surface"
        >
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-8 sm:py-20">
            <OrderDraft
              pizzas={previewPizzas}
              slots={previewSlots}
              maxPerOrder={previewDrop.maxPizzasPerOrder}
            />
          </div>
        </section>

        <section
          id="so-gehts"
          className="mx-auto w-full max-w-6xl scroll-mt-4 px-4 py-20 sm:px-8"
        >
          <h2 className="text-4xl">So funktioniert&apos;s</h2>
          <ol className="mt-10 grid gap-10 sm:grid-cols-3">
            {[
              [
                "Pizzen wählen",
                "Stell dir deine Bestellung aus der Karte des Drops zusammen.",
              ],
              [
                "Abholzeit sichern",
                "Jede Pizza belegt einen Slot im Ofen. Du siehst sofort, wann alles fertig ist.",
              ],
              [
                "Bezahlen & abholen",
                "Online bezahlen, zur Abholzeit vorbeikommen, Code zeigen, genießen.",
              ],
            ].map(([title, text], i) => (
              <li key={title}>
                <span className="font-serif text-5xl text-olive italic">
                  {i + 1}
                </span>
                <h3 className="mt-2 text-2xl">{title}</h3>
                <p className="mt-2 text-ink-muted">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="alarm" className="scroll-mt-4 bg-olive-soft">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-16 sm:px-8 md:grid-cols-2 md:items-center">
            <div>
              <h2 className="text-4xl">Nie wieder einen Drop verpassen</h2>
              <p className="mt-3 text-ink-muted">
                Wir schreiben dir, sobald der Verkauf für den nächsten Drop
                startet. Kein Spam, jederzeit abbestellbar.
              </p>
            </div>
            <form className="flex flex-col gap-3 sm:flex-row">
              <label htmlFor="alarm-email" className="sr-only">
                E-Mail-Adresse
              </label>
              <input
                id="alarm-email"
                type="email"
                required
                placeholder="deine@email.de"
                className="h-10 flex-1 rounded-md border border-line bg-surface px-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              />
              <Button type="submit" size="lg" className="h-10">
                <Bell aria-hidden />
                Drop-Alarm aktivieren
              </Button>
            </form>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-line px-4 py-8 text-sm sm:px-8">
        <Wordmark className="text-xl" />
        <nav className="flex gap-5 text-ink-muted">
          <Link href="/impressum">Impressum</Link>
          <Link href="/datenschutz">Datenschutz</Link>
          <Link href="/agb">AGB</Link>
        </nav>
      </footer>
    </>
  );
}
