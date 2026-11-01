import type { OrderStatus } from "@/lib/domain/drops";
import { cn } from "@/lib/utils";
import { ORDER_STATUS_LABELS, ORDER_STATUS_STYLES } from "./labels";

export function OrderStatusBadge({
  status,
  expired = false,
}: {
  status: OrderStatus;
  /** Offene Zahlung, deren Reservierung abgelaufen ist */
  expired?: boolean;
}) {
  const shown = expired ? "EXPIRED" : status;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
        ORDER_STATUS_STYLES[shown],
      )}
    >
      {ORDER_STATUS_LABELS[shown]}
    </span>
  );
}
