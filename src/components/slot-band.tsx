import { cn } from "@/lib/utils";

export type SlotBandState =
  "free" | "taken" | "blocked" | "selected" | "done" | "current";

const stateClass: Record<SlotBandState, string> = {
  free: "bg-transparent border-line",
  taken: "bg-ink-muted/35 border-transparent",
  blocked:
    "border-line bg-[repeating-linear-gradient(135deg,var(--line)_0_2px,transparent_2px_5px)]",
  selected: "bg-olive border-transparent",
  done: "bg-olive/40 border-transparent",
  current: "bg-terracotta border-transparent animate-pulse",
};

/**
 * Das Slot-Band: ein Strich pro Slot (= eine Pizza). Rein visuell; die bedienbare
 * Auswahl liegt immer in einer separaten, zugänglichen Liste.
 */
export function SlotBand({
  states,
  label,
  size = "md",
  className,
}: {
  states: SlotBandState[];
  label: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        "flex w-full items-end gap-[3px]",
        size === "sm" && "h-6",
        size === "md" && "h-10",
        size === "lg" && "h-14",
        className,
      )}
    >
      {states.map((state, i) => (
        <span
          key={i}
          className={cn(
            "h-full min-w-0 flex-1 rounded-[2px] border transition-colors duration-150",
            // jeder fünfte Strich etwas höher, damit das Band sich wie ein Lineal liest
            i % 5 === 0 ? "h-full" : "h-4/5",
            stateClass[state],
          )}
        />
      ))}
    </div>
  );
}
