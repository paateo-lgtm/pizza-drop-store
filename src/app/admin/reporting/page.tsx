import { ChevronRight, Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { parseReportFilter } from "@/lib/domain/reporting";
import { formatLongDate } from "@/lib/format";
import { loadReport } from "@/lib/reporting/queries";
import { PageHeader, PageSkeleton } from "../_components/page-header";
import { FactGrid, kpiFacts, PizzaTable } from "./report-parts";

export const metadata: Metadata = { title: "Reporting" };

export default function ReportingPage(props: PageProps<"/admin/reporting">) {
  return (
    <>
      <PageHeader
        title="Reporting"
        description="Bezahlte Bestellungen; der Zeitraum gilt für den Backtag des Drops."
      />
      <Suspense fallback={<PageSkeleton rows={8} />}>
        <Dashboard searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Dashboard({
  searchParams,
}: Pick<PageProps<"/admin/reporting">, "searchParams">) {
  await requireUser("reports:view");
  const query = await searchParams;
  const filter = parseReportFilter(query);
  const value = (key: "von" | "bis") =>
    typeof query[key] === "string" && filter[key === "von" ? "from" : "to"]
      ? (query[key] as string)
      : "";

  const [report, drops] = await Promise.all([
    loadReport(filter),
    db.drop.findMany({
      where: {
        OR: [
          // Der gewählte Drop bleibt auswählbar, auch außerhalb des Zeitraums
          ...(filter.dropId ? [{ id: filter.dropId }] : []),
          {
            orders: { some: { paidAt: { not: null } } },
            bakeStartsAt: {
              ...(filter.from && { gte: filter.from }),
              ...(filter.to && { lt: filter.to }),
            },
          },
        ],
      },
      orderBy: { bakeStartsAt: "desc" },
      take: 50,
      select: { id: true, title: true, bakeStartsAt: true },
    }),
  ]);

  const exportQuery = new URLSearchParams();
  if (value("von")) exportQuery.set("von", value("von"));
  if (value("bis")) exportQuery.set("bis", value("bis"));
  if (filter.dropId) exportQuery.set("drop", filter.dropId);

  return (
    <div className="flex flex-col gap-10">
      <form
        method="get"
        className="flex flex-wrap items-end gap-4 rounded-md border border-line bg-surface p-4"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="von">Von</Label>
          <Input id="von" name="von" type="date" defaultValue={value("von")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bis">Bis</Label>
          <Input id="bis" name="bis" type="date" defaultValue={value("bis")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="drop">Drop</Label>
          <select
            id="drop"
            name="drop"
            defaultValue={filter.dropId ?? ""}
            className="h-9 rounded-md border border-input bg-surface px-2 text-sm focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <option value="">Alle Drops</option>
            {drops.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title} · {formatLongDate(d.bakeStartsAt)}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit">Anwenden</Button>
        <Link
          href="/admin/reporting"
          className="h-9 content-center text-sm text-ink-muted underline-offset-4 hover:underline"
        >
          Zurücksetzen
        </Link>
        <a
          href={`/admin/reporting/export${exportQuery.size ? `?${exportQuery}` : ""}`}
          className="ml-auto inline-flex h-9 items-center gap-2 text-sm text-olive underline-offset-4 hover:underline"
          download
        >
          <Download className="size-4" aria-hidden />
          CSV exportieren
        </a>
      </form>

      <FactGrid facts={kpiFacts(report.kpis)} />

      <section aria-labelledby="pizzen" className="flex flex-col gap-3">
        <h2 id="pizzen" className="border-b border-line pb-2 text-2xl">
          Pizzen
        </h2>
        <PizzaTable pizzas={report.pizzas} />
      </section>

      <section aria-labelledby="drops" className="flex flex-col gap-3">
        <h2 id="drops" className="border-b border-line pb-2 text-2xl">
          Berichte pro Drop
        </h2>
        {drops.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Keine Drops mit bezahlten Bestellungen im Zeitraum.
          </p>
        ) : (
          <ul className="divide-y divide-line border-b border-line">
            {drops.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/admin/reporting/drops/${d.id}`}
                  className="flex items-center justify-between gap-4 py-2.5 hover:bg-wash"
                >
                  <span>
                    {d.title}
                    <span className="text-sm text-ink-muted">
                      {" "}
                      · {formatLongDate(d.bakeStartsAt)}
                    </span>
                  </span>
                  <ChevronRight className="size-4 text-ink-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
