import { ChevronRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SlotBand } from "@/components/slot-band";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { effectiveStatus, slotStatus } from "@/lib/domain/drops";
import { formatDuration, formatLongDate, formatTime } from "@/lib/format";
import { PageHeader, PageSkeleton } from "../_components/page-header";
import { SavedToast } from "../_components/saved-toast";
import { StatusBadge } from "./status-badge";

export const metadata: Metadata = { title: "Drops" };

export default function DropsPage(props: PageProps<"/admin/drops">) {
  return (
    <>
      <PageHeader
        title="Drops"
        description="Ein Slot ist eine Pizza im Ofen. Ab Verkaufsstart ist das Raster fix."
        action={
          <Button asChild>
            <Link href="/admin/drops/neu">
              <Plus /> Neuer Drop
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<PageSkeleton />}>
        <Drops />
        <SavedToast searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Drops() {
  await requireUser("drops:manage");
  const now = new Date();
  const drops = await db.drop.findMany({
    orderBy: { bakeStartsAt: "desc" },
    take: 100,
    include: {
      slots: {
        orderBy: { seq: "asc" },
        select: {
          state: true,
          orderId: true,
          reservedUntil: true,
          order: { select: { status: true } },
        },
      },
    },
  });

  if (drops.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-line p-10 text-center">
        <p className="font-serif text-2xl">Noch keine Drops</p>
        <p className="mt-2 text-sm text-ink-muted">
          Leg einen Drop an: Backzeitraum, Zeit pro Pizza und die Pizzen, die es
          geben soll.
        </p>
        <Button asChild className="mt-6">
          <Link href="/admin/drops/neu">
            <Plus /> Ersten Drop anlegen
          </Link>
        </Button>
      </div>
    );
  }

  const rows = drops.map((drop) => {
    const states = drop.slots.map((slot) =>
      slotStatus({ ...slot, orderStatus: slot.order?.status ?? null }, now),
    );
    const status = effectiveStatus(drop, now);
    return {
      ...drop,
      status,
      states,
      done: status === "COMPLETED" || status === "CANCELLED",
      sold: states.filter((s) => s === "sold").length,
      capacity: Math.min(
        states.filter((s) => s !== "blocked").length,
        drop.maxPizzasTotal ?? Infinity,
      ),
    };
  });
  const upcoming = rows.filter((r) => !r.done).reverse();
  const past = rows.filter((r) => r.done);

  return (
    <div className="flex flex-col gap-10">
      <DropList title="Anstehend" rows={upcoming} empty="Kein Drop geplant." />
      {past.length > 0 && <DropList title="Vergangen" rows={past} />}
    </div>
  );
}

function DropList({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: {
    id: string;
    title: string;
    status: ReturnType<typeof effectiveStatus>;
    bakeStartsAt: Date;
    bakeEndsAt: Date;
    slotSeconds: number;
    states: ReturnType<typeof slotStatus>[];
    sold: number;
    capacity: number;
  }[];
  empty?: string;
}) {
  return (
    <section>
      <h2 className="mb-3 border-b border-line pb-2 text-2xl">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((drop) => (
            <li key={drop.id}>
              <Link
                href={`/admin/drops/${drop.id}`}
                className="group grid gap-x-6 gap-y-2 py-4 transition-colors hover:bg-wash sm:grid-cols-[1fr_14rem_auto] sm:items-center sm:px-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{drop.title}</span>
                    <StatusBadge status={drop.status} />
                  </div>
                  <p className="mt-0.5 text-sm text-ink-muted">
                    {formatLongDate(drop.bakeStartsAt)} ·{" "}
                    {formatTime(drop.bakeStartsAt)}–
                    {formatTime(drop.bakeEndsAt)} ·{" "}
                    {formatDuration(drop.slotSeconds)} min pro Pizza
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <SlotBand
                    size="sm"
                    label={`${drop.sold} von ${drop.capacity} Pizzen verkauft`}
                    states={drop.states.map((s) =>
                      s === "sold" || s === "reserved"
                        ? "taken"
                        : s === "blocked"
                          ? "blocked"
                          : "free",
                    )}
                  />
                  <span className="text-xs text-ink-muted tabular-nums">
                    {drop.sold} / {drop.capacity} verkauft
                  </span>
                </div>
                <ChevronRight
                  className="hidden size-4 text-ink-muted transition-transform group-hover:translate-x-0.5 sm:block"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
