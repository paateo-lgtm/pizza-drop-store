import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatLongDate, formatPrice, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader, PageSkeleton } from "../_components/page-header";
import { OrderStatusBadge } from "./order-status-badge";

export const metadata: Metadata = { title: "Bestellungen" };

const FILTERS = {
  aktiv: {
    label: "Aktiv",
    statuses: ["PENDING_PAYMENT", "PAID", "IN_PROGRESS", "READY"],
  },
  bezahlt: { label: "Bezahlt", statuses: ["PAID", "IN_PROGRESS", "READY"] },
  abgeschlossen: { label: "Abgeholt", statuses: ["PICKED_UP"] },
  storniert: {
    label: "Storniert/Erstattet",
    statuses: ["CANCELLED", "REFUNDED", "NO_SHOW"],
  },
  alle: { label: "Alle", statuses: null },
} as const;

type FilterKey = keyof typeof FILTERS;

export default function OrdersPage(props: PageProps<"/admin/bestellungen">) {
  return (
    <>
      <PageHeader
        title="Bestellungen"
        description="Offene Zahlungen verfallen nach der Reservierungszeit von selbst."
      />
      <Suspense fallback={<PageSkeleton />}>
        <Orders searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Orders({
  searchParams,
}: Pick<PageProps<"/admin/bestellungen">, "searchParams">) {
  await requireUser("orders:view");
  const query = await searchParams;
  const filter: FilterKey =
    typeof query.status === "string" && query.status in FILTERS
      ? (query.status as FilterKey)
      : "aktiv";
  const dropId = typeof query.drop === "string" ? query.drop : undefined;
  const statuses = FILTERS[filter].statuses;
  const now = new Date();

  const [orders, drops] = await Promise.all([
    db.order.findMany({
      where: {
        ...(dropId && { dropId }),
        ...(statuses && { status: { in: [...statuses] } }),
        // Abgelaufene Reservierungen sind keine aktiven Bestellungen
        ...(filter === "aktiv" && {
          NOT: { status: "PENDING_PAYMENT", expiresAt: { lte: now } },
        }),
      },
      orderBy: [{ pickupAt: "asc" }, { number: "asc" }],
      take: 300,
      include: {
        items: { select: { quantity: true, nameSnapshot: true } },
        drop: { select: { title: true } },
      },
    }),
    db.drop.findMany({
      where: { orders: { some: {} } },
      orderBy: { bakeStartsAt: "desc" },
      take: 20,
      select: { id: true, title: true, bakeStartsAt: true },
    }),
  ]);

  const href = (next: { status?: string; drop?: string | null }) => {
    const params = new URLSearchParams();
    const status = next.status ?? filter;
    const drop = next.drop === undefined ? dropId : next.drop;
    if (status !== "aktiv") params.set("status", status);
    if (drop) params.set("drop", drop);
    const qs = params.toString();
    return `/admin/bestellungen${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Filter" className="flex flex-col gap-3">
        <ul className="flex flex-wrap gap-2">
          {(Object.keys(FILTERS) as FilterKey[]).map((key) => (
            <li key={key}>
              <Chip href={href({ status: key })} active={key === filter}>
                {FILTERS[key].label}
              </Chip>
            </li>
          ))}
        </ul>
        {drops.length > 0 && (
          <ul className="flex flex-wrap gap-2 text-sm">
            <li>
              <Chip href={href({ drop: null })} active={!dropId}>
                Alle Drops
              </Chip>
            </li>
            {drops.map((d) => (
              <li key={d.id}>
                <Chip href={href({ drop: d.id })} active={d.id === dropId}>
                  {d.title} · {formatLongDate(d.bakeStartsAt)}
                </Chip>
              </li>
            ))}
          </ul>
        )}
      </nav>

      {orders.length === 0 ? (
        <p className="rounded-md border border-dashed border-line p-10 text-center text-ink-muted">
          Keine Bestellungen für diesen Filter.
        </p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {orders.map((order) => {
            const count = order.items.reduce((s, i) => s + i.quantity, 0);
            return (
              <li key={order.id}>
                <Link
                  href={`/admin/bestellungen/${order.id}`}
                  className="grid grid-cols-[4rem_1fr_auto] items-center gap-x-4 gap-y-1 py-3 hover:bg-wash/60 sm:grid-cols-[4rem_6rem_1fr_auto_auto_1.25rem]"
                >
                  <span className="font-medium tabular-nums">
                    #{order.number}
                  </span>
                  <span className="hidden text-sm tabular-nums sm:block">
                    {formatTime(order.pickupAt)} Uhr
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate">{order.customerName}</span>
                    <span className="block truncate text-xs text-ink-muted">
                      {count} {count === 1 ? "Pizza" : "Pizzen"} ·{" "}
                      {order.drop.title}
                      <span className="sm:hidden">
                        {" "}
                        · {formatTime(order.pickupAt)} Uhr
                      </span>
                    </span>
                  </span>
                  <span className="hidden text-sm tabular-nums sm:block">
                    {formatPrice(order.totalCents)}
                  </span>
                  <OrderStatusBadge
                    status={order.status}
                    expired={
                      order.status === "PENDING_PAYMENT" &&
                      order.expiresAt <= now
                    }
                  />
                  <ChevronRight
                    className="hidden size-4 text-ink-muted sm:block"
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex rounded-md border border-line px-3 py-1 text-sm transition-colors hover:border-olive",
        active && "border-olive bg-olive text-primary-foreground",
      )}
    >
      {children}
    </Link>
  );
}
