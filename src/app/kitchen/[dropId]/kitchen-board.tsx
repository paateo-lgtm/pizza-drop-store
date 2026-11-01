"use client";

import {
  ArrowLeft,
  Check,
  Flame,
  PackageCheck,
  PauseCircle,
  Timer,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { SlotBand, type SlotBandState } from "@/components/slot-band";
import { Button } from "@/components/ui/button";
import { formatDuration, formatTime } from "@/lib/format";
import type { KitchenBoard } from "@/lib/kitchen/kitchen";
import type { KitchenResult } from "@/lib/kitchen/kitchen";
import { cn } from "@/lib/utils";
import {
  blockNextSlotAction,
  finishTicketAction,
  pickUpAction,
  startTicketAction,
} from "../actions";

const clock = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "Europe/Berlin",
});

/**
 * Uhr im Takt der Serverzeit: Alle Geräte zeigen dieselbe Zeit, auch wenn ihre
 * eigene Uhr falsch geht. Der Abstand wird bei jedem Polling neu bestimmt.
 */
function useServerNow(serverNow: Date) {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const offset = serverNow.getTime() - Date.now();
    const tick = () => setNow(new Date(Date.now() + offset));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [serverNow]);
  return now;
}

/** Führt eine Küchenaktion aus und meldet Ablehnungen sichtbar. */
function useKitchenAction() {
  const [pending, startTransition] = useTransition();
  function run(action: () => Promise<KitchenResult>) {
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) toast.error(result.message);
      } catch {
        toast.error("Keine Verbindung – bitte gleich noch einmal tippen.");
      }
    });
  }
  return { pending, run };
}

function bandState(slot: KitchenBoard["slots"][number]): SlotBandState {
  if (slot.ticketStatus === "DONE") return "done";
  if (slot.ticketStatus === "OVEN") return "current";
  if (slot.status === "sold" || slot.status === "reserved") return "taken";
  return slot.status === "blocked" ? "blocked" : "free";
}

const sectionTitle = "font-sans text-sm font-semibold tracking-wide uppercase";

export function KitchenBoardView({ board }: { board: KitchenBoard }) {
  const { pending, run } = useKitchenAction();
  const { drop, current, next, later, ready, pickedUp, average, slotHint } =
    board;
  const allDone = board.totalCount > 0 && board.doneCount === board.totalCount;

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-line px-6 py-4">
        <div className="flex items-center gap-4">
          <Link
            href="/kitchen"
            aria-label="Zur Drop-Auswahl"
            className="rounded-md p-2 text-ink-muted hover:text-foreground"
          >
            <ArrowLeft className="size-6" aria-hidden />
          </Link>
          <div>
            <p className="text-xs tracking-wide text-ink-muted uppercase">
              Küche · {drop.title}
            </p>
            <p className="text-4xl font-semibold tabular-nums">
              <span className="sr-only">Uhrzeit </span>
              <LiveClock serverNow={board.serverNow} />
            </p>
          </div>
        </div>
        <div
          role="status"
          className={cn(
            "rounded-md px-3 py-2 text-lg font-semibold tabular-nums",
            board.delaySeconds > 0
              ? "bg-terracotta-soft text-terracotta"
              : "bg-olive-soft text-olive",
          )}
        >
          {board.delaySeconds > 0
            ? `+${formatDuration(board.delaySeconds)} Verzug`
            : "Im Plan"}
        </div>
        <div className="text-sm text-ink-muted">
          {average
            ? `Ø ${formatDuration(average.seconds)} pro Pizza`
            : "Ø noch offen"}{" "}
          · Slot {formatDuration(drop.slotSeconds)} · {board.doneCount} von{" "}
          {board.totalCount} gebacken
          {slotHint && (
            <span className="block text-terracotta">
              Nächster Drop mit {formatDuration(slotHint)} pro Slot?
            </span>
          )}
        </div>
        <div className="ml-auto flex min-w-64 flex-1 flex-col gap-1">
          <SlotBand
            states={board.slots.map(bandState)}
            size="sm"
            label={`Fortschritt: ${board.doneCount} von ${board.totalCount} Pizzen gebacken`}
          />
          <div className="flex justify-between text-xs text-ink-muted tabular-nums">
            <span>{formatTime(drop.bakeStartsAt)}</span>
            <span>{formatTime(drop.bakeEndsAt)}</span>
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
            className={cn(
              sectionTitle,
              "flex items-center gap-2 text-terracotta",
            )}
          >
            <Flame className="size-4" aria-hidden /> Jetzt im Ofen
          </h2>
          {current ? (
            <OvenTimer
              ticket={current}
              slotSeconds={drop.slotSeconds}
              serverNow={board.serverNow}
            />
          ) : (
            <p className="text-2xl text-ink-muted">
              {allDone
                ? "Alles gebacken. Feierabend in Sicht!"
                : board.totalCount === 0
                  ? "Noch keine bezahlten Pizzen."
                  : "Ofen ist frei."}
            </p>
          )}
          <div className="mt-auto grid grid-cols-2 gap-3">
            <Button
              size="lg"
              className="h-16 text-lg aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
              aria-disabled={!current || pending}
              onClick={() => {
                if (current && !pending)
                  run(() => finishTicketAction(current.id));
              }}
            >
              <Check aria-hidden /> Fertig
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-16 text-lg aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
              aria-disabled={pending}
              onClick={() => {
                if (!pending) run(() => blockNextSlotAction(drop.id));
              }}
            >
              <PauseCircle aria-hidden /> Puffer-Slot
            </Button>
          </div>
        </section>

        <section
          aria-labelledby="naechste"
          className="flex flex-col bg-background p-6"
        >
          <h2 id="naechste" className={cn(sectionTitle, "text-ink-muted")}>
            Als Nächstes · belegen
          </h2>
          {next ? (
            <div className="mt-4 rounded-md border-2 border-olive p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-serif text-4xl">{next.pizza}</p>
                <span className="text-xl tabular-nums">
                  {formatTime(next.slotStartsAt)}
                </span>
              </div>
              <p className="mt-1 text-ink-muted">
                #{next.orderNumber} · {next.customer} · Pizza {next.position}{" "}
                von {next.of}
              </p>
              <Button
                size="lg"
                className="mt-4 h-14 w-full text-lg aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                aria-disabled={Boolean(current) || pending}
                onClick={() => {
                  if (current) {
                    toast.info("Erst die Pizza im Ofen fertig melden.");
                  } else if (!pending) {
                    run(() => startTicketAction(next.id));
                  }
                }}
              >
                <Flame aria-hidden /> In den Ofen
              </Button>
            </div>
          ) : (
            <p className="mt-4 text-lg text-ink-muted">
              Keine Pizza mehr in der Warteschlange.
            </p>
          )}
          {later.length > 0 && (
            <>
              <h3 className={cn(sectionTitle, "mt-8 text-ink-muted")}>
                Danach
              </h3>
              <ol className="mt-2 divide-y divide-line">
                {later.map((entry) =>
                  entry.kind === "gap" ? (
                    <li
                      key={`gap-${entry.startsAt.getTime()}`}
                      className="py-3 text-sm text-olive italic"
                    >
                      {formatTime(entry.startsAt)}
                      {entry.count > 1
                        ? ` + ${entry.count - 1} weitere`
                        : ""}{" "}
                      frei · Zeit zum Aufholen
                    </li>
                  ) : (
                    <li
                      key={entry.ticketId}
                      className="flex items-baseline justify-between gap-3 py-3"
                    >
                      <span className="w-14 text-lg tabular-nums">
                        {formatTime(entry.startsAt)}
                      </span>
                      <span className="flex-1 text-xl">
                        {entry.ticket.pizza}
                      </span>
                      <span className="text-sm text-ink-muted">
                        #{entry.ticket.orderNumber} · {entry.ticket.position}/
                        {entry.ticket.of}
                      </span>
                    </li>
                  ),
                )}
              </ol>
            </>
          )}
        </section>

        <section
          aria-labelledby="abholbereit"
          className="flex flex-col bg-background p-6"
        >
          <h2 id="abholbereit" className={cn(sectionTitle, "text-olive")}>
            Abholbereit
          </h2>
          {ready.length === 0 ? (
            <p className="mt-4 text-lg text-ink-muted">
              Noch nichts abholbereit.
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {ready.map((order) => (
                <li
                  key={order.id}
                  className="rounded-md border border-line bg-surface p-4"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-semibold tabular-nums">
                      #{order.number}
                    </span>
                    <span className="text-ink-muted tabular-nums">
                      {formatTime(order.pickupAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-lg">{order.customer}</p>
                  <p className="text-sm text-ink-muted">
                    {order.pizzas} · Code{" "}
                    <span className="font-mono tracking-widest">
                      {order.pickupCode}
                    </span>
                  </p>
                  <Button
                    variant="outline"
                    className="mt-3 h-11 w-full aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                    aria-disabled={pending}
                    onClick={() => {
                      if (!pending) run(() => pickUpAction(order.id));
                    }}
                  >
                    <PackageCheck aria-hidden /> Abgeholt
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {pickedUp.length > 0 && (
            <p className="mt-6 text-sm text-ink-muted">
              Abgeholt: {pickedUp.map((o) => `#${o.number}`).join(", ")}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

/** Eigene Komponente, damit nur die Uhr im Sekundentakt neu rendert, nicht das Board. */
function LiveClock({ serverNow }: { serverNow: Date }) {
  const now = useServerNow(serverNow);
  return <>{clock.format(now)}</>;
}

function OvenTimer({
  ticket,
  slotSeconds,
  serverNow,
}: {
  ticket: NonNullable<KitchenBoard["current"]>;
  slotSeconds: number;
  serverNow: Date;
}) {
  const now = useServerNow(serverNow);
  const elapsed = ticket.ovenStartedAt
    ? Math.max(0, (now.getTime() - ticket.ovenStartedAt.getTime()) / 1000)
    : 0;
  const left = slotSeconds - elapsed;
  const progress = Math.min(1, elapsed / slotSeconds);
  return (
    <>
      <div>
        <p className="font-serif text-6xl leading-none">{ticket.pizza}</p>
        <p className="mt-3 text-lg text-ink-muted">
          #{ticket.orderNumber} · {ticket.customer} · Pizza {ticket.position}{" "}
          von {ticket.of}
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
              left < 0 && "text-terracotta",
            )}
          >
            {left < 0 ? "+" : ""}
            {formatDuration(Math.abs(left))}
          </span>
        </div>
        <div
          className="mt-3 h-3 overflow-hidden rounded-full bg-wash"
          role="progressbar"
          aria-label="Ofenzeit"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <div
            className="h-full bg-terracotta transition-[width] duration-1000 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
    </>
  );
}
