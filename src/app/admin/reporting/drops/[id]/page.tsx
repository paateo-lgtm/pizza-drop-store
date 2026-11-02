import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { slotUsage } from "@/lib/domain/reporting";
import { formatLongDate, formatTime } from "@/lib/format";
import { loadDropReport } from "@/lib/reporting/queries";
import { PageHeader, PageSkeleton } from "../../../_components/page-header";
import { getSlotRows } from "../../../drops/data";
import {
  FactGrid,
  formatPercent,
  kpiFacts,
  PizzaTable,
  SalesChart,
} from "../../report-parts";

export const metadata: Metadata = { title: "Drop-Bericht" };

/** Dauer in Stunden und Minuten, z. B. „2 h 05 min“ */
function formatSpan(ms: number) {
  const minutes = Math.round(ms / 60_000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
}

export default function DropReportPage(
  props: PageProps<"/admin/reporting/drops/[id]">,
) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Drop-Bericht" />
          <PageSkeleton rows={8} />
        </>
      }
    >
      <DropReport params={props.params} />
    </Suspense>
  );
}

async function DropReport({
  params,
}: Pick<PageProps<"/admin/reporting/drops/[id]">, "params">) {
  await requireUser("reports:view");
  const { id } = await params;
  const report = await loadDropReport(id);
  if (!report) notFound();
  const usage = slotUsage(
    (await getSlotRows(id, new Date())).map((s) => s.status),
  );

  return (
    <>
      <Link
        href={`/admin/reporting?drop=${report.drop.id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Reporting
      </Link>
      <PageHeader
        title={report.drop.title}
        description={`Backtag ${formatLongDate(report.drop.bakeStartsAt)} · Verkaufsstart ${formatLongDate(report.drop.saleStartsAt)}, ${formatTime(report.drop.saleStartsAt)} Uhr`}
      />
      <div className="flex flex-col gap-10">
        <FactGrid
          facts={[
            {
              label: "Auslastung",
              value: formatPercent(usage.utilization),
              hint: `${usage.sold} verkauft, ${usage.blocked} gesperrt, ${usage.free} frei`,
            },
            {
              label: "Ausverkauft nach",
              value:
                report.soldOutAfterMs === null
                  ? "–"
                  : formatSpan(report.soldOutAfterMs),
              hint:
                report.soldOutAfterMs === null
                  ? "nicht ausverkauft"
                  : "ab Verkaufsstart",
            },
            ...kpiFacts(report.kpis),
          ]}
        />

        <section aria-labelledby="verlauf" className="flex flex-col gap-3">
          <h2 id="verlauf" className="border-b border-line pb-2 text-2xl">
            Verkaufsverlauf
          </h2>
          <SalesChart points={report.points} capacity={report.capacity} />
        </section>

        <section aria-labelledby="pizzen" className="flex flex-col gap-3">
          <h2 id="pizzen" className="border-b border-line pb-2 text-2xl">
            Top-Pizzen
          </h2>
          <PizzaTable pizzas={report.pizzas} />
        </section>

        <p className="text-sm text-ink-muted">
          Slot-Raster mit Belegung:{" "}
          <Link
            href={`/admin/drops/${report.drop.id}`}
            className="text-olive underline-offset-4 hover:underline"
          >
            Drop-Seite
          </Link>
        </p>
      </div>
    </>
  );
}
