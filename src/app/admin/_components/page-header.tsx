import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-4xl">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-ink-muted">{description}</p>
        )}
      </div>
      {action}
    </header>
  );
}

export function PageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div
      role="status"
      className="flex flex-col gap-3"
      aria-busy="true"
      aria-label="Lädt"
    >
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-md bg-wash" />
      ))}
    </div>
  );
}
