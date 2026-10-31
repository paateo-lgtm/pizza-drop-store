"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import type { SlotStatus } from "@/lib/domain/drops";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toggleSlotBlock } from "./actions";
import { SLOT_LABELS } from "./labels";

export type SlotTile = {
  id: string;
  seq: number;
  startsAt: Date;
  endsAt: Date;
  status: SlotStatus;
  orderNumber: number | null;
  /** Darf gesperrt bzw. freigegeben werden (frei/gesperrt, in der Zukunft, Drop nicht beendet) */
  toggleable: boolean;
};

const TILE: Record<SlotStatus, string> = {
  free: "border-line bg-surface text-ink",
  reserved: "border-ochre/60 bg-ochre/10 text-ink",
  sold: "border-transparent bg-olive text-paper",
  blocked:
    "border-line text-ink-muted bg-[repeating-linear-gradient(135deg,var(--line)_0_2px,transparent_2px_6px)]",
};

export function SlotGrid({ slots }: { slots: SlotTile[] }) {
  const [, startTransition] = useTransition();
  const [tiles, setOptimistic] = useOptimistic(
    slots,
    (current, slotId: string) =>
      current.map((s) =>
        s.id === slotId
          ? { ...s, status: s.status === "free" ? "blocked" : "free" }
          : s,
      ) as SlotTile[],
  );

  const counts = tiles.reduce(
    (acc, s) => ({ ...acc, [s.status]: acc[s.status] + 1 }),
    { free: 0, reserved: 0, sold: 0, blocked: 0 } as Record<SlotStatus, number>,
  );

  function toggle(slot: SlotTile) {
    startTransition(async () => {
      setOptimistic(slot.id);
      try {
        const result = await toggleSlotBlock(slot.id);
        if (result?.ok === false && result.message) {
          toast.error(result.message);
        }
      } catch {
        // z. B. abgelaufene Sitzung oder keine Verbindung; die Anzeige springt von selbst zurück.
        toast.error("Das hat nicht geklappt. Bitte die Seite neu laden.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <ul
        className="flex flex-wrap gap-x-5 gap-y-1 text-sm"
        aria-label="Legende"
      >
        {(Object.keys(SLOT_LABELS) as SlotStatus[]).map((status) => (
          <li key={status} className="flex items-center gap-2">
            <span
              aria-hidden
              className={cn("size-3.5 rounded-[3px] border", TILE[status])}
            />
            <span className="text-ink-muted">
              {SLOT_LABELS[status]}{" "}
              <span className="text-ink tabular-nums">{counts[status]}</span>
            </span>
          </li>
        ))}
      </ul>
      <ol className="grid grid-cols-[repeat(auto-fill,minmax(4.75rem,1fr))] gap-1.5">
        {tiles.map((slot) => {
          const time = formatTime(slot.startsAt);
          const label = `Slot ${slot.seq}, ${time}–${formatTime(slot.endsAt)}, ${SLOT_LABELS[slot.status]}${
            slot.orderNumber ? `, Bestellung ${slot.orderNumber}` : ""
          }`;
          const body = (
            <>
              <span className="text-sm font-medium tabular-nums">{time}</span>
              <span className="text-[11px] leading-none opacity-80">
                {slot.orderNumber
                  ? `#${slot.orderNumber}`
                  : SLOT_LABELS[slot.status]}
              </span>
            </>
          );
          const base =
            "flex h-14 w-full flex-col items-center justify-center gap-1 rounded-md border";
          return (
            <li key={slot.id}>
              {slot.toggleable ? (
                <button
                  type="button"
                  onClick={() => toggle(slot)}
                  aria-label={`${label} – ${slot.status === "free" ? "sperren" : "freigeben"}`}
                  aria-pressed={slot.status === "blocked"}
                  className={cn(
                    base,
                    TILE[slot.status],
                    "cursor-pointer transition-colors hover:border-terracotta focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                  )}
                >
                  {body}
                </button>
              ) : (
                <div
                  aria-label={label}
                  className={cn(base, TILE[slot.status], "opacity-90")}
                >
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-ink-muted">
        Tippe auf einen freien Slot, um ihn als Puffer zu sperren, und auf einen
        gesperrten, um ihn wieder freizugeben. Belegte und vergangene Slots
        bleiben unverändert.
      </p>
    </div>
  );
}
