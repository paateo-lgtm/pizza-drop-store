import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { PageHeader, PageSkeleton } from "../_components/page-header";

export const metadata: Metadata = { title: "Protokoll" };

const ACTIONS: Record<string, string> = {
  create: "angelegt",
  update: "geändert",
  delete: "gelöscht",
  activate: "aktiviert",
  deactivate: "deaktiviert",
  reorder: "neu sortiert",
  status: "Status geändert",
  duplicate: "dupliziert",
  block: "Slot gesperrt",
  unblock: "Slot freigegeben",
  cancel: "Storniert",
};

const ENTITIES: Record<string, string> = {
  pizza: "Pizza",
  ingredient: "Zutat",
  settings: "Einstellungen",
  user: "Zugang",
  drop: "Drop",
  order: "Bestellung",
};

const dateTime = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Berlin",
});

export default function AuditPage() {
  return (
    <>
      <PageHeader
        title="Protokoll"
        description="Die letzten 200 Änderungen im Admin-Bereich."
      />
      <Suspense fallback={<PageSkeleton />}>
        <AuditLog />
      </Suspense>
    </>
  );
}

function describeDiff(diff: unknown): string {
  if (!diff || typeof diff !== "object") return "";
  return Object.entries(diff as Record<string, unknown>)
    .map(([key, value]) => {
      if (value && typeof value === "object" && "to" in value) {
        return `${key}: ${JSON.stringify((value as { to: unknown }).to)}`;
      }
      return `${key}: ${JSON.stringify(value)}`;
    })
    .join(" · ");
}

async function AuditLog() {
  await requireUser("audit:view");
  const entries = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { name: true } } },
  });

  if (entries.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        Noch keine Änderungen protokolliert.
      </p>
    );
  }

  return (
    <ol className="max-w-4xl divide-y divide-line rounded-md border border-line">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="grid gap-1 bg-surface px-4 py-3 sm:grid-cols-[10rem_1fr]"
        >
          <time
            dateTime={entry.createdAt.toISOString()}
            className="text-sm text-ink-muted tabular-nums"
          >
            {dateTime.format(entry.createdAt)}
          </time>
          <div className="min-w-0">
            <p className="text-sm">
              <span className="font-medium">
                {entry.user?.name ?? "Gelöschter Zugang"}
              </span>{" "}
              hat {ENTITIES[entry.entity] ?? entry.entity}{" "}
              {ACTIONS[entry.action] ?? entry.action}
            </p>
            {entry.diff && (
              <p
                className="truncate text-xs text-ink-muted"
                title={describeDiff(entry.diff)}
              >
                {describeDiff(entry.diff)}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
