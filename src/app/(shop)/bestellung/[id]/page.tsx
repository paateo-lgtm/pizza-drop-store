import { MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import QRCode from "qrcode";
import { Suspense, type ReactNode } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import { Countdown } from "@/components/countdown";
import { Button } from "@/components/ui/button";
import { verifyOrderKey } from "@/lib/booking/order-link";
import { db } from "@/lib/db";
import { isOrderActive } from "@/lib/domain/booking";
import type { OrderStatus } from "@/lib/domain/drops";
import { formatLongDate, formatPrice, formatTime } from "@/lib/format";
import { reconcileReturn } from "@/lib/payment/reconcile";
import { isStripeConfigured } from "@/lib/payment/stripe";
import { startPayment } from "./actions";
import { PayForm } from "./pay-form";

export const metadata: Metadata = {
  title: "Deine Bestellung",
  robots: { index: false },
};

const STATUS: Partial<Record<OrderStatus, { title: string; text: string }>> = {
  PAID: {
    title: "Bezahlt – wir backen für dich.",
    text: "Komm zur Abholzeit vorbei und zeig deinen Abholcode.",
  },
  IN_PROGRESS: {
    title: "Deine Pizzen sind im Ofen.",
    text: "Gleich geschafft – zeig zur Abholzeit deinen Abholcode.",
  },
  READY: {
    title: "Abholbereit!",
    text: "Deine Pizzen warten auf dich. Zeig einfach deinen Abholcode.",
  },
  PICKED_UP: {
    title: "Abgeholt. Guten Appetit!",
    text: "Danke für deine Bestellung.",
  },
  CANCELLED: {
    title: "Diese Bestellung wurde storniert.",
    text: "Falls du schon bezahlt hast, erstatten wir dir den vollen Betrag.",
  },
  REFUNDED: {
    title: "Diese Bestellung wurde erstattet.",
    text: "Den vollen Betrag haben wir dir erstattet; je nach Bank dauert die Gutschrift ein paar Tage.",
  },
  NO_SHOW: {
    title: "Diese Bestellung wurde nicht abgeholt.",
    text: "Bei Fragen melde dich gern bei uns.",
  },
  EXPIRED: {
    title: "Die Reservierung ist abgelaufen.",
    text: "Die Zahlung kam nicht rechtzeitig, deshalb sind die Slots wieder frei.",
  },
};

/** Bestellungen, für die der Abholcode gilt */
const CODE_VISIBLE: OrderStatus[] = ["PAID", "IN_PROGRESS", "READY"];

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
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const key = typeof query.k === "string" ? query.k : undefined;
  // Ohne gültigen Schlüssel verhält sich die Seite, als gäbe es die Bestellung nicht.
  if (!key || !verifyOrderKey(id, key)) notFound();

  const loadOrder = () =>
    db.order.findUnique({
      where: { id },
      include: {
        items: true,
        drop: { select: { title: true, slug: true, location: true } },
        slots: { orderBy: { seq: "asc" }, select: { startsAt: true } },
      },
    });
  let order = await loadOrder();
  if (!order) notFound();

  // Zurück von Stripe: selbst nachfragen und eine bezahlte Session sofort verbuchen.
  // Nur solange die Zahlung offen ist; danach genügt die eine Abfrage oben.
  const returned =
    query.bezahlt === "1" && order.status === "PENDING_PAYMENT"
      ? await reconcileReturn(order)
      : null;
  if (returned === "settled") {
    order = await loadOrder();
    if (!order) notFound();
  }

  const now = new Date();
  const pending = order.status === "PENDING_PAYMENT";
  // Bezahlt, aber noch nicht bestätigt (Stripe nicht erreichbar oder verzögerte Zahlart)
  const confirming = pending && returned === "pending";
  const reserved =
    pending && !confirming && isOrderActive(order.status, order.expiresAt, now);
  const expired = pending && !confirming && !reserved;
  const bakeFrom = order.slots[0]?.startsAt;
  const status = STATUS[expired ? "EXPIRED" : order.status];

  return (
    <article className="mt-6">
      <p className="text-sm font-medium tracking-wide text-terracotta uppercase">
        Bestellung {order.number} · {order.drop.title}
      </p>

      {reserved && (
        <>
          <Title>Deine Abholzeit ist reserviert.</Title>
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
            {isStripeConfigured() ? (
              <>
                <p className="mt-2 text-sm text-ink-muted">
                  Sicher bezahlen per Karte, Apple Pay oder Google Pay. Du wirst
                  dafür kurz zu unserem Zahlungsanbieter Stripe weitergeleitet.
                </p>
                <PayForm
                  action={startPayment.bind(null, order.id, key)}
                  label={`Jetzt bezahlen · ${formatPrice(order.totalCents)}`}
                />
              </>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">
                Die Online-Zahlung wird gerade eingerichtet. Sobald sie
                freigeschaltet ist, schließt du die Bestellung hier ab.
              </p>
            )}
          </div>
        </>
      )}

      {confirming && (
        <>
          <Title>Zahlung wird bestätigt …</Title>
          <p className="mt-4 text-lg text-ink-muted" role="status">
            Das dauert meist nur ein paar Sekunden. Die Seite aktualisiert sich
            von selbst; die Bestätigung kommt außerdem per E-Mail.
          </p>
          {/* 3 s, dann wachsend bis 15 s (ca. 3 min): meist kommt der Webhook in Sekunden,
              danach fragt jedes Neuladen sonst unnötig oft bei Stripe nach. */}
          <AutoRefresh
            everyMs={3000}
            growth={1.5}
            maxEveryMs={15_000}
            maxTimes={15}
            fallback={
              <p className="mt-6 rounded-md border border-line bg-surface p-4 text-sm">
                Die Bestätigung dauert ungewöhnlich lange. Deine Zahlung ist
                nicht verloren: Sobald sie bei uns ankommt, bekommst du eine
                E-Mail. Du kannst diese Seite später neu laden.
              </p>
            }
          />
        </>
      )}

      {!reserved && !confirming && status && (
        <>
          <Title>{status.title}</Title>
          <p className="mt-4 text-lg text-ink-muted">{status.text}</p>
          {expired && (
            <Button asChild size="lg" className="mt-8">
              <Link href={`/drop/${order.drop.slug}`}>Neu bestellen</Link>
            </Button>
          )}
          {CODE_VISIBLE.includes(order.status) && (
            <>
              <PickupCode code={order.pickupCode} />
              {/* Statusseite: Küche meldet „im Ofen“ und „abholbereit“ (Phase 5) */}
              <AutoRefresh everyMs={15_000} />
            </>
          )}
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

function Title({ children }: { children: ReactNode }) {
  return <h1 className="mt-3 text-5xl leading-[1.05]">{children}</h1>;
}

async function PickupCode({ code }: { code: string }) {
  // Die Küche scannt den Code bei der Ausgabe (Phase 5); er enthält nur den Abholcode.
  const svg = await QRCode.toString(code, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#2b2620", light: "#fcfaf5" },
  });
  return (
    <section
      aria-labelledby="abholcode"
      className="mt-8 flex flex-wrap items-center gap-6 rounded-md border border-line bg-surface p-5"
    >
      <div
        className="size-36 shrink-0 [&_svg]:size-full"
        role="img"
        aria-label={`QR-Code für Abholcode ${code}`}
        // Vom QR-Generator aus dem eigenen Abholcode erzeugt, keine Nutzereingabe
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div>
        <h2 id="abholcode" className="text-sm text-ink-muted">
          Abholcode
        </h2>
        <p className="mt-1 font-mono text-4xl font-semibold tracking-[0.2em]">
          {code}
        </p>
        <p className="mt-2 text-sm text-ink-muted">
          Zeig den Code oder den QR-Code bei der Abholung.
        </p>
      </div>
    </section>
  );
}
