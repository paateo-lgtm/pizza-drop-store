"use client";

import { Check, Flame, PauseCircle, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { SlotBand, type SlotBandState } from "@/components/slot-band";
import { Button } from "@/components/ui/button";
import { formatDuration, formatTime } from "@/lib/format";
import { previewDrop, previewKitchen, previewSlots } from "@/lib/mock/preview";
import { cn } from "@/lib/utils";

const clock = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "Europe/Berlin",
});

/** Lässt die Beispielzeit ab dem Laden mitlaufen, damit Uhr und Timer lebendig wirken. */
function usePreviewNow() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - started), 1000);
    return () => clearInterval(id);
  }, []);
  return new Date(previewKitchen.now.getTime() + elapsed);
}

export function KitchenPreview() {
  const now = usePreviewNow();
  const { current, queue, ready, doneSlots, delaySeconds, averageSeconds } =
    previewKitchen;
  const slotSeconds = previewDrop.slotSeconds;

  const ovenElapsed = Math.max(
    0,
    (now.getTime() - current.ovenStartedAt.getTime()) / 1000,
  );
  const ovenLeft = slotSeconds - ovenElapsed;
  const progress = Math.min(1, ovenElapsed / slotSeconds);

  const band: SlotBandState[] = previewSlots.map((s, i) => {
    if (i < doneSlots && s.state === "taken") return "done";
    if (i === current.slotIndex) return "current";
    return s.state;
  });

  const next = queue[0];
  const later = queue.slice(1);

  return (
    <div className="kitchen flex min-h-dvh flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-line px-6 py-4">
        <div>
          <p className="text-xs tracking-wide text-ink-muted uppercase">
            Küche · {previewDrop.title}
          </p>
          <p
            className="text-4xl font-semibold tabular-nums"
            aria-label="Aktuelle Uhrzeit"
          >
            {clock.format(now)}
          </p>
        </div>
        <div
          className={cn(
            "rounded-md px-3 py-2 text-lg font-semibold tabular-nums",
            delaySeconds > 0
              ? "bg-terracotta-soft text-terracotta"
              : "bg-olive-soft text-olive",
          )}
        >
          {delaySeconds > 0
            ? `+${formatDuration(delaySeconds)} Verzug`
            : "Im Plan"}
        </div>
        <div className="text-sm text-ink-muted">
          Ø {formatDuration(averageSeconds)} pro Pizza · Slot{" "}
          {formatDuration(slotSeconds)}
        </div>
        <div className="ml-auto flex min-w-64 flex-1 flex-col gap-1">
          <SlotBand states={band} size="sm" label="Fortschritt des Drops" />
          <div className="flex justify-between text-xs text-ink-muted tabular-nums">
            <span>{formatTime(previewDrop.bakeStartsAt)}</span>
            <span>{formatTime(previewDrop.bakeEndsAt)}</span>
          </div>
        </div>
      </header>

      <main className="grid flex-1 gap-px bg-[var(--line)] lg:grid-cols-[1.4fr_1fr_1fr]">
        <section
          aria-labelledby="jetzt"
          className="flex flex-col gap-6 bg-background p-6"
        >
          <h2
            id="jetzt"
            className="flex items-center gap-2 font-sans text-sm font-semibold tracking-wide text-terracotta uppercase"
          >
            <Flame className="size-4" aria-hidden /> Jetzt im Ofen
          </h2>
          <div>
            <p className="font-serif text-6xl leading-none">{current.pizza}</p>
            <p className="mt-3 text-lg text-ink-muted">
              #{current.orderNumber} · {current.customer} · Pizza{" "}
              {current.position} von {current.of}
            </p>
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <span className="flex items-center gap-2 text-sm">
                <Timer className="size-4" aria-hidden /> Ofen-Timer
              </span>
              <span
                className={cn(
                  "text-5xl font-semibold tabular-nums",
                  ovenLeft < 0 && "text-terracotta",
                )}
              >
                {formatDuration(ovenLeft)}
              </span>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-wash">
              <div
                className="h-full bg-terracotta transition-[width] duration-1000 ease-linear"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
          <div className="mt-auto grid grid-cols-2 gap-3">
            <Button size="lg" className="h-16 text-lg">
              <Check aria-hidden /> Fertig
            </Button>
            <Button size="lg" variant="outline" className="h-16 text-lg">
              <PauseCircle aria-hidden /> Puffer-Slot
            </Button>
          </div>
        </section>

        <section
          aria-labelledby="naechste"
          className="flex flex-col bg-background p-6"
        >
          <h2
            id="naechste"
            className="font-sans text-sm font-semibold tracking-wide text-ink-muted uppercase"
          >
            Als Nächstes · belegen
          </h2>
          <div className="mt-4 rounded-md border-2 border-olive p-4">
            <div className="flex items-baseline justify-between">
              <p className="font-serif text-4xl">{next.pizza}</p>
              <span className="text-xl tabular-nums">
                {formatTime(previewSlots[next.slotIndex].startsAt)}
              </span>
            </div>
            <p className="mt-1 text-ink-muted">
              #{next.orderNumber} · {next.customer} · {next.position}/{next.of}
            </p>
            <Button size="lg" className="mt-4 h-14 w-full text-lg">
              <Flame aria-hidden /> In den Ofen
            </Button>
          </div>
          <h3 className="mt-8 font-sans text-sm font-semibold tracking-wide text-ink-muted uppercase">
            Danach
          </h3>
          <ol className="mt-2 divide-y divide-line">
            <li className="py-3 text-sm text-olive italic">
              17:36 und 17:42 frei · Zeit zum Aufholen
            </li>
            {later.map((t) => (
              <li
                key={t.slotIndex}
                className="flex items-baseline justify-between gap-3 py-3"
              >
                <span className="w-14 text-lg tabular-nums">
                  {formatTime(previewSlots[t.slotIndex].startsAt)}
                </span>
                <span className="flex-1 text-xl">{t.pizza}</span>
                <span className="text-sm text-ink-muted">
                  #{t.orderNumber} · {t.position}/{t.of}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section
          aria-labelledby="abholbereit"
          className="flex flex-col bg-background p-6"
        >
          <h2
            id="abholbereit"
            className="font-sans text-sm font-semibold tracking-wide text-olive uppercase"
          >
            Abholbereit
          </h2>
          <ul className="mt-4 flex flex-col gap-3">
            {ready.map((order) => (
              <li
                key={order.orderNumber}
                className="rounded-md border border-line bg-surface p-4"
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-semibold tabular-nums">
                    #{order.orderNumber}
                  </span>
                  <span className="text-ink-muted tabular-nums">
                    {formatTime(order.pickupAt)}
                  </span>
                </div>
                <p className="mt-1 text-lg">{order.customer}</p>
                <p className="text-sm text-ink-muted">{order.pizzas}</p>
                <Button variant="outline" className="mt-3 h-11 w-full">
                  Abgeholt
                </Button>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
