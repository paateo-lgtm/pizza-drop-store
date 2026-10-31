import { cn } from "@/lib/utils";

/** Platzhalter-Wortmarke, bis ein Logo vorliegt (dann nach public/brand/ austauschen). */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-serif text-2xl leading-none font-semibold tracking-tight italic",
        className,
      )}
    >
      Pizza <span className="text-terracotta">Drop</span>
    </span>
  );
}
