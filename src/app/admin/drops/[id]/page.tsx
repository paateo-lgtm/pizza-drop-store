import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import {
  canToggleSlotBlock,
  dropActions,
  effectiveStatus,
} from "@/lib/domain/drops";
import {
  formatDuration,
  formatLongDate,
  formatPrice,
  formatTime,
} from "@/lib/format";
import { PageHeader, PageSkeleton } from "../../_components/page-header";
import { SavedToast } from "../../_components/saved-toast";
import { getSlotRows } from "../data";
import { DropActions } from "../drop-actions";
import { SlotGrid } from "../slot-grid";
import { StatusBadge } from "../status-badge";

export const metadata: Metadata = { title: "Drop" };

const dateTime = (date: Date) =>
  `${formatLongDate(date)}, ${formatTime(date)} Uhr`;

export default function DropPage(props: PageProps<"/admin/drops/[id]">) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Drop" />
          <PageSkeleton rows={6} />
        </>
      }
    >
      <DropDetail params={props.params} />
      <SavedToast searchParams={props.searchParams} />
    </Suspense>
  );
}

async function DropDetail({
  params,
}: Pick<PageProps<"/admin/drops/[id]">, "params">) {
  await requireUser("drops:manage");
  const { id } = await params;
  const drop = await db.drop.findUnique({
    where: { id },
    include: {
      pizzas: {
        orderBy: { sortOrder: "asc" },
        include: { pizza: { select: { name: true, priceCents: true } } },
      },
      _count: { select: { orders: true } },
    },
  });
  if (!drop) notFound();

  const now = new Date();
  const status = effectiveStatus(drop, now);
  const slots = await getSlotRows(drop.id, now);
  const count = (s: string) => slots.filter((slot) => slot.status === s).length;
  const sellable = Math.min(
    slots.length - count("blocked"),
    drop.maxPizzasTotal ?? Infinity,
  );
  const ended = status === "COMPLETED" || status === "CANCELLED";

  const facts = [
    {
      label: "Verkauft",
      value: count("sold"),
      hint: `von ${sellable} möglich`,
    },
    { label: "Reserviert", value: count("reserved"), hint: "Zahlung läuft" },
    { label: "Gesperrt", value: count("blocked"), hint: "Puffer" },
    {
      label: "Zeit pro Pizza",
      value: formatDuration(drop.slotSeconds),
      hint: `${slots.length} Slots`,
    },
  ];

  return (
    <>
      <Link
        href="/admin/drops"
        className="-mt-4 mb-4 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> Alle Drops
      </Link>
      <PageHeader
        title={drop.title}
        description={`${formatLongDate(drop.bakeStartsAt)} · ${formatTime(drop.bakeStartsAt)}–${formatTime(drop.bakeEndsAt)} Uhr${drop.location ? ` · ${drop.location}` : ""}`}
        action={
          <DropActions
            dropId={drop.id}
            title={drop.title}
            actions={dropActions(status)}
            editable={!ended}
            deletable={
              (drop.status === "DRAFT" || drop.status === "CANCELLED") &&
              drop._count.orders === 0
            }
          />
        }
      />
      <div className="-mt-4 mb-8 flex flex-wrap items-center gap-4">
        <StatusBadge status={status} />
        <Link
          href={`/kitchen/${drop.id}/vorbereitung`}
          className="text-sm text-olive underline-offset-4 hover:underline"
        >
          Vorbereitungsliste
        </Link>
        <Link
          href={`/kitchen/${drop.id}`}
          className="text-sm text-olive underline-offset-4 hover:underline"
        >
          Küchen-Board
        </Link>
        <Link
          href={`/admin/reporting/drops/${drop.id}`}
          className="text-sm text-olive underline-offset-4 hover:underline"
        >
          Bericht
        </Link>
      </div>

      <dl className="mb-10 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-[var(--line)] md:grid-cols-4">
        {facts.map((fact) => (
          <div key={fact.label} className="flex flex-col gap-1 bg-surface p-4">
            <dt className="text-sm text-ink-muted">{fact.label}</dt>
            <dd className="font-serif text-3xl tabular-nums">{fact.value}</dd>
            <dd className="text-xs text-ink-muted">{fact.hint}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-10 lg:grid-cols-[1fr_18rem]">
        <section className="flex min-w-0 flex-col gap-4">
          <h2 className="border-b border-line pb-2 text-2xl">Slot-Raster</h2>
          {slots.length === 0 ? (
            <p className="text-sm text-ink-muted">
              Dieser Drop hat kein Raster. Bitte Backzeitraum und Slotlänge
              prüfen.
            </p>
          ) : (
            <SlotGrid
              slots={slots.map((slot) => ({
                ...slot,
                toggleable: canToggleSlotBlock(
                  slot.status,
                  slot.startsAt,
                  status,
                  now,
                ),
              }))}
            />
          )}
        </section>

        <aside className="flex flex-col gap-8">
          <section className="flex flex-col gap-3">
            <h2 className="border-b border-line pb-2 text-2xl">Pizzen</h2>
            {drop.pizzas.length === 0 ? (
              <p className="text-sm text-terracotta">
                Noch keine Pizza zugeordnet – ohne Pizza lässt sich der Drop
                nicht veröffentlichen.
              </p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {drop.pizzas.map((row) => (
                  <li key={row.pizzaId} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate">{row.pizza.name}</span>
                    <span className="shrink-0 text-ink-muted tabular-nums">
                      {formatPrice(
                        row.priceOverrideCents ?? row.pizza.priceCents,
                      )}
                      {row.maxQuantity !== null && ` · max. ${row.maxQuantity}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="flex flex-col gap-3 text-sm">
            <h2 className="border-b border-line pb-2 text-2xl">Verkauf</h2>
            <dl className="grid gap-2">
              <div>
                <dt className="text-ink-muted">Start</dt>
                <dd>{dateTime(drop.saleStartsAt)}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Ende</dt>
                <dd>{dateTime(drop.saleEndsAt)}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Pro Bestellung</dt>
                <dd>höchstens {drop.maxPizzasPerOrder} Pizzen</dd>
              </div>
            </dl>
            {drop.notes && (
              <p className="rounded-md bg-wash px-3 py-2 text-ink-muted">
                {drop.notes}
              </p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
