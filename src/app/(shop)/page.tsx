import { ArrowRight, MapPin } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Countdown } from "@/components/countdown";
import { SlotBand } from "@/components/slot-band";
import { Button } from "@/components/ui/button";
import type { DropAvailability } from "@/lib/booking/availability";
import {
  offeredPizzas,
  pizzaCount,
  SALE_LABELS,
  saleState,
  slotLength,
  toBandState,
} from "@/lib/booking/display";
import { featuredDrop, getUpcomingDrops } from "@/lib/booking/shop";
import { formatLongDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <>
      <Suspense fallback={<HeroSkeleton />}>
        <Drops />
      </Suspense>

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
    </>
  );
}

async function Drops() {
  await connection();
  const now = new Date();
  const drops = await getUpcomingDrops(now);
  const featured = featuredDrop(drops);
  if (!featured) return <NoDrop />;
  const others = drops.filter((d) => d.drop.id !== featured.drop.id);

  return (
    <>
      <Hero data={featured} now={now} />
      {others.length > 0 && (
        <section
          aria-labelledby="weitere"
          className="border-y border-line bg-surface"
        >
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-8">
            <h2 id="weitere" className="text-3xl">
              Weitere Drops
            </h2>
            <ul className="mt-6 divide-y divide-line border-y border-line">
              {others.map((d) => (
                <li key={d.drop.id}>
                  <Link
                    href={`/drop/${d.drop.slug}`}
                    className="group flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-4"
                  >
                    <span className="text-xl group-hover:text-olive">
                      {formatLongDate(d.drop.bakeStartsAt)}
                    </span>
                    <span className="flex items-center gap-4 text-sm text-ink-muted">
                      <span className="tabular-nums">
                        {formatTime(d.drop.bakeStartsAt)}–
                        {formatTime(d.drop.bakeEndsAt)} Uhr
                      </span>
                      <span>
                        {SALE_LABELS[saleState(d.drop.status, d.remaining)]}
                      </span>
                      <ArrowRight className="size-4" aria-hidden />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}

function Hero({ data, now }: { data: DropAvailability; now: Date }) {
  const { drop, slots, remaining } = data;
  const state = saleState(drop.status, remaining);
  const offered = offeredPizzas(slots, drop.maxPizzasTotal);
  const href = `/drop/${drop.slug}`;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-10 pb-16 sm:px-8 sm:pt-16">
      <p className="text-sm font-medium tracking-wide text-terracotta uppercase">
        {drop.title} · {formatLongDate(drop.bakeStartsAt)}
      </p>
      <h1 className="mt-4 text-5xl leading-[1.05] sm:text-7xl">
        <span className="lining-nums tabular-nums">
          {formatTime(drop.bakeStartsAt)}–{formatTime(drop.bakeEndsAt)}
        </span>{" "}
        <span className="text-ink-muted italic">Uhr</span>
      </h1>
      <p className="mt-5 max-w-xl text-lg text-ink-muted">
        {pizzaCount(offered)}, eine nach der anderen aus dem Ofen, alle{" "}
        {slotLength(drop.slotSeconds)} eine. Du wählst deine Abholzeit, wir
        backen genau dafür.
      </p>

      <div className="mt-10 max-w-3xl">
        <SlotBand
          size="lg"
          states={slots.map((s) => toBandState(s.status))}
          label={`${remaining} von ${offered} Pizzen noch frei`}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span>
            <strong className="font-semibold tabular-nums">{remaining}</strong>{" "}
            <span className="text-ink-muted">von {offered} noch frei</span>
          </span>
          {drop.location && (
            <span className="flex items-center gap-1.5 text-ink-muted">
              <MapPin className="size-4" aria-hidden />
              {drop.location}
            </span>
          )}
        </div>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
        {state === "open" ? (
          <Button asChild size="lg">
            <Link href={href}>Abholzeit sichern</Link>
          </Button>
        ) : (
          <Button asChild size="lg" variant="outline">
            <Link href={href}>Zur Karte</Link>
          </Button>
        )}
        <SaleNote data={data} now={now} />
      </div>
    </section>
  );
}

function SaleNote({ data, now }: { data: DropAvailability; now: Date }) {
  const { drop, remaining } = data;
  const state = saleState(drop.status, remaining);
  const tone = state === "open" ? "text-ink-muted" : "text-terracotta";

  if (state === "upcoming") {
    return (
      <p className="text-sm">
        <span className="text-ink-muted">Verkaufsstart in </span>
        <Countdown
          target={drop.saleStartsAt}
          serverNow={now}
          className="font-semibold text-terracotta"
        />
        <span className="block text-ink-muted">
          {formatLongDate(drop.saleStartsAt)}, {formatTime(drop.saleStartsAt)}{" "}
          Uhr
        </span>
      </p>
    );
  }
  if (state === "open") {
    return (
      <p className={cn("text-sm", tone)}>
        Verkauf bis {formatLongDate(drop.saleEndsAt)},{" "}
        {formatTime(drop.saleEndsAt)} Uhr
      </p>
    );
  }
  return (
    <p className={cn("text-sm font-medium", tone)}>{SALE_LABELS[state]}</p>
  );
}

function NoDrop() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-10 pb-16 sm:px-8 sm:pt-16">
      <p className="text-sm font-medium tracking-wide text-terracotta uppercase">
        Nächster Drop
      </p>
      <h1 className="mt-4 max-w-3xl text-5xl leading-[1.05] sm:text-6xl">
        Gerade ist kein Drop geplant.
      </h1>
      <p className="mt-5 max-w-xl text-lg text-ink-muted">
        Der Ofen ruht. Sobald der nächste Termin steht, findest du ihn hier –
        mit Karte und freien Abholzeiten.
      </p>
    </section>
  );
}

function HeroSkeleton() {
  return (
    <section
      className="mx-auto w-full max-w-6xl px-4 pt-10 pb-16 sm:px-8 sm:pt-16"
      aria-busy="true"
      aria-label="Nächster Drop lädt"
    >
      <div className="h-4 w-56 animate-pulse rounded bg-wash" />
      <div className="mt-6 h-16 w-full max-w-lg animate-pulse rounded bg-wash" />
      <div className="mt-6 h-6 w-full max-w-md animate-pulse rounded bg-wash" />
      <div className="mt-10 h-14 w-full max-w-3xl animate-pulse rounded bg-wash" />
    </section>
  );
}
