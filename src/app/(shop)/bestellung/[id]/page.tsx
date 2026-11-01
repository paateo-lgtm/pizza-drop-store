import { MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Countdown } from "@/components/countdown";
import { Button } from "@/components/ui/button";
import { verifyOrderKey } from "@/lib/booking/order-link";
import { db } from "@/lib/db";
import { isOrderActive } from "@/lib/domain/booking";
import { formatLongDate, formatPrice, formatTime } from "@/lib/format";

export const metadata: Metadata = {
  title: "Deine Bestellung",
  robots: { index: false },
};

const STATUS_TITLES: Partial<Record<string, string>> = {
  PAID: "Bezahlt – wir backen für dich.",
  IN_PROGRESS: "Deine Pizzen sind im Ofen.",
  READY: "Abholbereit!",
  PICKED_UP: "Abgeholt. Guten Appetit!",
  CANCELLED: "Diese Bestellung wurde storniert.",
  REFUNDED: "Diese Bestellung wurde erstattet.",
  NO_SHOW: "Diese Bestellung wurde nicht abgeholt.",
  EXPIRED: "Die Reservierung ist abgelaufen.",
};

export default function OrderPage(props: PageProps<"/bestellung/[id]">) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-6 pb-20 sm:px-8">
      <Suspense
        fallback={
          <div
            className="mt-6 h-64 animate-pulse rounded-md bg-wash"
            aria-busy="true"
            aria-label="Bestellung lädt"
          />
        }
      >
        <OrderContent params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function OrderContent({
  params,
  searchParams,
}: PageProps<"/bestellung/[id]">) {
  await connection();
  const [{ id }, { k }] = await Promise.all([params, searchParams]);
  // Ohne gültigen Schlüssel verhält sich die Seite, als gäbe es die Bestellung nicht.
  if (!verifyOrderKey(id, typeof k === "string" ? k : undefined)) notFound();

  const order = await db.order.findUnique({
    where: { id },
    include: {
      items: true,
      customer: { select: { name: true } },
      drop: { select: { title: true, slug: true, location: true } },
      slots: { orderBy: { seq: "asc" }, select: { startsAt: true } },
    },
  });
  if (!order) notFound();

  const now = new Date();
  const reserved =
    order.status === "PENDING_PAYMENT" &&
    isOrderActive(order.status, order.expiresAt, now);
  const expired = order.status === "PENDING_PAYMENT" && !reserved;
  const bakeFrom = order.slots[0]?.startsAt;

  return (
    <article className="mt-6">
      <p className="text-sm font-medium tracking-wide text-terracotta uppercase">
        Bestellung {order.number} · {order.drop.title}
      </p>

      {reserved && (
        <>
          <h1 className="mt-3 text-5xl leading-[1.05]">
            Deine Abholzeit ist reserviert.
          </h1>
          <p className="mt-4 text-lg text-ink-muted">
            Wir halten deine Slots noch{" "}
            <Countdown
              target={order.expiresAt}
              serverNow={now}
              className="font-semibold text-terracotta"
            />{" "}
            Minuten für dich, bis {formatTime(order.expiresAt)} Uhr.
          </p>
          <div className="mt-8 rounded-md border border-line bg-surface p-5">
            <h2 className="text-2xl">Zahlung</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Die Online-Zahlung per Karte, Apple Pay und Google Pay wird gerade
              eingerichtet. Sobald sie freigeschaltet ist, schließt du die
              Bestellung hier ab.
            </p>
            <Button size="lg" className="mt-4" disabled>
              Jetzt bezahlen · {formatPrice(order.totalCents)}
            </Button>
          </div>
        </>
      )}

      {expired && (
        <>
          <h1 className="mt-3 text-5xl leading-[1.05]">
            Die Reservierung ist abgelaufen.
          </h1>
          <p className="mt-4 text-lg text-ink-muted" role="status">
            Die Zahlung kam nicht rechtzeitig, deshalb sind die Slots wieder
            frei. Schau nach, ob deine Wunschzeit noch zu haben ist.
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link href={`/drop/${order.drop.slug}`}>Neu bestellen</Link>
          </Button>
        </>
      )}

      {!reserved && !expired && (
        <>
          <h1 className="mt-3 text-5xl leading-[1.05]">
            {STATUS_TITLES[order.status] ?? "Deine Bestellung"}
          </h1>
          <p className="mt-4 text-lg text-ink-muted">
            Abholcode{" "}
            <strong className="font-semibold tracking-widest text-ink">
              {order.pickupCode}
            </strong>
          </p>
        </>
      )}

      <dl className="mt-12 grid gap-x-8 gap-y-5 border-t border-line pt-8 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-ink-muted">Abholung</dt>
          <dd className="mt-1 text-2xl tabular-nums">
            {formatTime(order.pickupAt)} Uhr
          </dd>
          <dd className="text-sm text-ink-muted">
            {formatLongDate(order.pickupAt)}
            {bakeFrom &&
              ` · gebacken ${formatTime(bakeFrom)}–${formatTime(order.pickupAt)}`}
          </dd>
        </div>
        {order.drop.location && (
          <div>
            <dt className="text-sm text-ink-muted">Abholort</dt>
            <dd className="mt-1 flex items-center gap-1.5">
              <MapPin className="size-4 text-ink-muted" aria-hidden />
              {order.drop.location}
            </dd>
          </div>
        )}
      </dl>

      <section aria-labelledby="positionen" className="mt-10">
        <h2 id="positionen" className="sr-only">
          Positionen
        </h2>
        <ul className="divide-y divide-line border-y border-line">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-4 py-3">
              <span>
                {item.quantity} × {item.nameSnapshot}
              </span>
              <span className="tabular-nums">
                {formatPrice(item.quantity * item.unitPriceCents)}
              </span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 grid grid-cols-2 gap-y-1 text-sm">
          <dt className="font-medium">Summe</dt>
          <dd className="text-right text-base font-semibold tabular-nums">
            {formatPrice(order.totalCents)}
          </dd>
          <dt className="text-ink-muted">enthaltene MwSt.</dt>
          <dd className="text-right text-ink-muted tabular-nums">
            {formatPrice(order.vatCents)}
          </dd>
        </dl>
      </section>
    </article>
  );
}
