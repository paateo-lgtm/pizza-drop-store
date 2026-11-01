import { ArrowLeft, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { Countdown } from "@/components/countdown";
import { saleState } from "@/lib/booking/display";
import { getShopDrop } from "@/lib/booking/shop";
import { formatLongDate, formatTime } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { OrderForm } from "./order-form";
import { WaitlistForm } from "./waitlist-form";

export const metadata: Metadata = { title: "Drop" };

export default function DropPage(props: PageProps<"/drop/[slug]">) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-20 sm:px-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> Alle Drops
      </Link>
      <Suspense fallback={<DropSkeleton />}>
        <DropContent params={props.params} />
      </Suspense>
    </div>
  );
}

async function DropContent({
  params,
}: Pick<PageProps<"/drop/[slug]">, "params">) {
  await connection();
  const { slug } = await params;
  const now = new Date();
  const [data, settings] = await Promise.all([
    getShopDrop(slug, now),
    getSettings(),
  ]);
  if (!data) notFound();

  const { drop, menu, slots, remaining, earliestStart } = data;
  const state = saleState(drop.status, remaining);
  const time = (date: Date) =>
    `${formatLongDate(date)}, ${formatTime(date)} Uhr`;

  const notes: Partial<Record<typeof state, ReactNode>> = {
    upcoming: (
      <Note title="Der Verkauf startet bald">
        Ab {time(drop.saleStartsAt)} kannst du hier deine Abholzeit sichern.
        Noch{" "}
        <Countdown
          target={drop.saleStartsAt}
          serverNow={now}
          className="font-semibold text-terracotta"
        />
        .
      </Note>
    ),
    soldOut: (
      <>
        <Note title="Ausverkauft">
          Alle Slots sind vergeben. Werden durch eine Stornierung oder eine
          abgelaufene Reservierung Slots frei, erscheinen sie hier wieder – und
          wer auf der Warteliste steht, bekommt eine Mail.
        </Note>
        <WaitlistForm dropId={drop.id} maxPerOrder={drop.maxPizzasPerOrder} />
      </>
    ),
    closed: (
      <Note title="Der Verkauf ist beendet">
        Für diesen Drop nehmen wir keine Bestellungen mehr an. Bis zum nächsten
        Mal!
      </Note>
    ),
    baking: (
      <Note title="Der Ofen läuft">
        Der Drop ist in vollem Gange. Neue Bestellungen sind nicht mehr möglich.
      </Note>
    ),
    cancelled: (
      <Note title="Dieser Drop wurde abgesagt">
        Bereits bezahlte Bestellungen erstatten wir vollständig.
      </Note>
    ),
  };

  return (
    <>
      <header className="mt-6 mb-14">
        <p className="text-sm font-medium tracking-wide text-terracotta uppercase">
          {formatLongDate(drop.bakeStartsAt)}
        </p>
        <h1 className="mt-3 text-5xl leading-[1.05] sm:text-6xl">
          {drop.title}
        </h1>
        <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-ink-muted">
          <span className="tabular-nums">
            Abholung {formatTime(drop.bakeStartsAt)}–
            {formatTime(drop.bakeEndsAt)} Uhr
          </span>
          {drop.location && (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden />
              {drop.location}
            </span>
          )}
        </p>
        {drop.notes && (
          <p className="mt-4 max-w-2xl text-ink-muted">{drop.notes}</p>
        )}
      </header>

      <OrderForm
        dropId={drop.id}
        menu={menu.map((p) => ({
          pizzaId: p.pizzaId,
          name: p.name,
          description: p.description,
          imageUrl: p.imageUrl,
          allergens: p.allergens,
          tags: p.tags,
          unitPriceCents: p.unitPriceCents,
          left:
            p.maxQuantity === null
              ? null
              : Math.max(0, p.maxQuantity - p.taken),
        }))}
        slots={slots.map(({ seq, startsAt, endsAt, status }) => ({
          seq,
          startsAt,
          endsAt,
          status,
        }))}
        earliestStart={earliestStart}
        maxPerOrder={drop.maxPizzasPerOrder}
        remaining={remaining}
        reservationMinutes={settings.reservationMinutes}
        vatRatePercent={settings.vatRatePercent}
        closedNote={notes[state]}
      />
    </>
  );
}

function Note({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="status" className="max-w-2xl">
      <h2 className="text-3xl">{title}</h2>
      <p className="mt-2 text-ink-muted">{children}</p>
    </div>
  );
}

function DropSkeleton() {
  return (
    <div className="mt-6" aria-busy="true" aria-label="Drop lädt">
      <div className="h-4 w-48 animate-pulse rounded bg-wash" />
      <div className="mt-4 h-14 w-full max-w-md animate-pulse rounded bg-wash" />
      <div className="mt-14 flex flex-col gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-md bg-wash" />
        ))}
      </div>
    </div>
  );
}
