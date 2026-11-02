import { requireUser } from "@/lib/auth/dal";
import { parseReportFilter, toCsv } from "@/lib/domain/reporting";
import { exportRows } from "@/lib/reporting/queries";

/** CSV der bezahlten Bestellpositionen im Filter des Dashboards */
export async function GET(request: Request) {
  await requireUser("reports:view");
  const params = new URL(request.url).searchParams;
  const filter = parseReportFilter({
    von: params.get("von") ?? undefined,
    bis: params.get("bis") ?? undefined,
    drop: params.get("drop") ?? undefined,
  });
  const csv = toCsv(await exportRows(filter));
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pizzadrop-bestellungen-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
