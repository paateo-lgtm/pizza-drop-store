import type { DropStatus } from "@/lib/domain/drops";
import { cn } from "@/lib/utils";
import { STATUS_LABELS, STATUS_STYLES } from "./labels";

export function StatusBadge({ status }: { status: DropStatus }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        STATUS_STYLES[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
