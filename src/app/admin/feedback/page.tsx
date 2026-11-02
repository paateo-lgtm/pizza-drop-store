import { Star } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatLongDate } from "@/lib/format";
import { PageHeader, PageSkeleton } from "../_components/page-header";

export const metadata: Metadata = { title: "Feedback" };

export default function FeedbackPage() {
  return (
    <>
      <PageHeader
        title="Feedback"
        description="Bewertungen nach der Abholung. Gefragt wird nur, wer beim Bestellen zugestimmt hat."
      />
      <Suspense fallback={<PageSkeleton />}>
        <FeedbackList />
      </Suspense>
    </>
  );
}

const average = (ratings: number[]) =>
  (ratings.reduce((s, r) => s + r, 0) / ratings.length).toLocaleString(
    "de-DE",
    { maximumFractionDigits: 1, minimumFractionDigits: 1 },
  );

async function FeedbackList() {
  await requireUser("reports:view");
  // chisle: die neuesten 200; Filter und Seiten mit dem Reporting (Phase 8)
  const entries = await db.feedback.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      order: {
        select: {
          id: true,
          number: true,
          customerName: true,
          drop: { select: { id: true, title: true, bakeStartsAt: true } },
        },
      },
    },
  });
  if (entries.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-line p-10 text-center text-ink-muted">
        Noch keine Bewertungen.
      </p>
    );
  }

  const byDrop = new Map<
    string,
    { title: string; bakeStartsAt: Date; ratings: number[] }
  >();
  for (const e of entries) {
    const drop = e.order.drop;
    const row = byDrop.get(drop.id) ?? { ...drop, ratings: [] };
    row.ratings.push(e.rating);
    byDrop.set(drop.id, row);
  }

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="pro-drop">
        <h2 id="pro-drop" className="text-2xl">
          Pro Drop
        </h2>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {[...byDrop.values()].map((d) => (
            <li
              key={d.title + d.bakeStartsAt.toISOString()}
              className="flex items-center justify-between gap-4 py-2.5"
            >
              <span>
                {d.title}
                <span className="text-sm text-ink-muted">
                  {" "}
                  · {formatLongDate(d.bakeStartsAt)}
                </span>
              </span>
              <span className="text-sm tabular-nums">
                Ø {average(d.ratings)} · {d.ratings.length}{" "}
                {d.ratings.length === 1 ? "Bewertung" : "Bewertungen"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="bewertungen">
        <h2 id="bewertungen" className="text-2xl">
          Bewertungen
        </h2>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {entries.map((e) => (
            <li key={e.id} className="flex flex-col gap-1 py-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span
                  className="flex text-terracotta"
                  aria-label={`${e.rating} von 5 Sternen`}
                  role="img"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      aria-hidden
                      className={`size-4 ${n <= e.rating ? "fill-current" : "fill-transparent"}`}
                    />
                  ))}
                </span>
                <Link
                  href={`/admin/bestellungen/${e.order.id}`}
                  className="text-sm underline underline-offset-4"
                >
                  #{e.order.number} · {e.order.customerName}
                </Link>
                <span className="text-sm text-ink-muted">
                  {e.order.drop.title} · {formatLongDate(e.createdAt)}
                </span>
              </div>
              {e.comment && (
                <p className="max-w-3xl whitespace-pre-line">{e.comment}</p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
