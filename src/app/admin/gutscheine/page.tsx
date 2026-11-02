import { ChevronRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { SOLD_ORDER_STATUSES } from "@/lib/domain/booking";
import { formatLongDate, formatPrice } from "@/lib/format";
import { PageHeader, PageSkeleton } from "../_components/page-header";
import { SavedToast } from "../_components/saved-toast";

export const metadata: Metadata = { title: "Gutscheine" };

export default function CouponsPage(props: PageProps<"/admin/gutscheine">) {
  return (
    <>
      <PageHeader
        title="Gutscheine"
        description="Eingelöst zählt erst mit bezahlter Bestellung. Erstattete und stornierte geben die Einlösung frei."
        action={
          <Button asChild>
            <Link href="/admin/gutscheine/neu">
              <Plus /> Neuer Gutschein
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<PageSkeleton />}>
        <Coupons />
        <SavedToast searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Coupons() {
  await requireUser("coupons:manage");
  const now = new Date();
  const [coupons, stats] = await Promise.all([
    db.coupon.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { drops: true } } },
    }),
    db.order.groupBy({
      by: ["couponId"],
      where: { couponId: { not: null }, status: { in: SOLD_ORDER_STATUSES } },
      _count: { _all: true },
      _sum: { discountCents: true },
    }),
  ]);
  const statsById = new Map(stats.map((s) => [s.couponId, s]));

  if (coupons.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-line p-10 text-center text-ink-muted">
        Noch keine Gutscheine.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-line border-y border-line">
      {coupons.map((coupon) => {
        const stat = statsById.get(coupon.id);
        const used = stat?._count._all ?? 0;
        const expired = coupon.validTo !== null && coupon.validTo < now;
        return (
          <li key={coupon.id}>
            <Link
              href={`/admin/gutscheine/${coupon.id}`}
              className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 py-3 hover:bg-wash/60 sm:grid-cols-[10rem_1fr_8rem_auto_1.25rem]"
            >
              <span className="font-mono font-medium">{coupon.code}</span>
              <span className="min-w-0 text-sm">
                <span className="block">
                  {coupon.type === "PERCENT"
                    ? `${coupon.value} %`
                    : formatPrice(coupon.value)}
                  {coupon._count.drops > 0 &&
                    ` · nur ${coupon._count.drops === 1 ? "1 Drop" : `${coupon._count.drops} Drops`}`}
                </span>
                <span className="block text-xs text-ink-muted">
                  {coupon.validTo
                    ? `bis ${formatLongDate(coupon.validTo)}`
                    : "unbefristet"}
                </span>
              </span>
              <span className="text-sm tabular-nums sm:text-right">
                {used}
                {coupon.maxRedemptions !== null &&
                  ` / ${coupon.maxRedemptions}`}{" "}
                eingelöst
                <span className="block text-xs text-ink-muted">
                  −{formatPrice(stat?._sum.discountCents ?? 0)}
                </span>
              </span>
              <Badge
                variant={coupon.active && !expired ? "default" : "outline"}
              >
                {!coupon.active ? "inaktiv" : expired ? "abgelaufen" : "aktiv"}
              </Badge>
              <ChevronRight
                className="hidden size-4 text-ink-muted sm:block"
                aria-hidden
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
