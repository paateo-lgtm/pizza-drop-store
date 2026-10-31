import type { DropAction, DropStatus, SlotStatus } from "@/lib/domain/drops";

export const STATUS_LABELS: Record<DropStatus, string> = {
  DRAFT: "Entwurf",
  SCHEDULED: "Geplant",
  ON_SALE: "Verkauf offen",
  SALE_CLOSED: "Verkauf geschlossen",
  LIVE: "Läuft",
  COMPLETED: "Abgeschlossen",
  CANCELLED: "Abgesagt",
};

export const STATUS_STYLES: Record<DropStatus, string> = {
  DRAFT: "border-line text-ink-muted",
  SCHEDULED: "border-olive/40 text-olive-deep",
  ON_SALE: "border-transparent bg-olive text-paper",
  SALE_CLOSED: "border-ochre/50 text-ochre",
  LIVE: "border-transparent bg-terracotta text-paper",
  COMPLETED: "border-line bg-wash text-ink-muted",
  CANCELLED: "border-terracotta/40 text-terracotta line-through",
};

export const ACTION_LABELS: Record<DropAction, string> = {
  publish: "Veröffentlichen",
  unpublish: "Zurück zu Entwurf",
  openSale: "Verkauf jetzt öffnen",
  closeSale: "Verkauf jetzt schließen",
  complete: "Drop abschließen",
  cancel: "Drop absagen",
};

export const ACTION_CONFIRM: Partial<Record<DropAction, string>> = {
  openSale:
    "Ab jetzt können Kunden bestellen. Backzeitraum und Slotlänge sind danach fix.",
  closeSale: "Es sind danach keine weiteren Bestellungen mehr möglich.",
  complete: "Der Drop wird beendet und erscheint nur noch im Reporting.",
  cancel:
    "Der Drop wird abgesagt und lässt sich nicht wieder öffnen. Das kann nicht rückgängig gemacht werden.",
};

export const SLOT_LABELS: Record<SlotStatus, string> = {
  free: "frei",
  reserved: "reserviert",
  sold: "verkauft",
  blocked: "gesperrt",
};
