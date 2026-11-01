import type { OrderStatus } from "@/lib/domain/drops";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Zahlung offen",
  PAID: "Bezahlt",
  IN_PROGRESS: "In Arbeit",
  READY: "Abholbereit",
  PICKED_UP: "Abgeholt",
  EXPIRED: "Abgelaufen",
  CANCELLED: "Storniert",
  REFUNDED: "Erstattet",
  NO_SHOW: "Nicht abgeholt",
};

export const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "border-ochre/50 text-ochre",
  PAID: "border-transparent bg-olive text-paper",
  IN_PROGRESS: "border-transparent bg-terracotta text-paper",
  READY: "border-olive/40 bg-olive-soft text-olive-deep",
  PICKED_UP: "border-line bg-wash text-ink-muted",
  EXPIRED: "border-line text-ink-muted",
  CANCELLED: "border-terracotta/40 text-terracotta line-through",
  REFUNDED: "border-terracotta/40 text-terracotta",
  NO_SHOW: "border-terracotta/40 text-terracotta",
};
