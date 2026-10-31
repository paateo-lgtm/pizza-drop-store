"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "2 T 04:05:09" bzw. "04:05:09" bzw. "05:09" */
export function formatCountdown(ms: number) {
  const { days, hours, minutes, seconds } = parts(ms);
  if (days > 0)
    return `${days} T ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Zählt bis `target` herunter. Gerechnet wird mit der Serverzeit (`serverNow`), damit eine
 * falsch gehende Geräteuhr den Countdown nicht verschiebt. Bei 0 lädt die Seite neu.
 */
export function Countdown({
  target,
  serverNow,
  refreshAtZero = true,
  className,
}: {
  target: Date;
  serverNow: Date;
  refreshAtZero?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [remaining, setRemaining] = useState(
    target.getTime() - serverNow.getTime(),
  );
  const offset = useRef<number | null>(null);

  useEffect(() => {
    offset.current = serverNow.getTime() - Date.now();
    const tick = () => {
      const left = target.getTime() - (Date.now() + (offset.current ?? 0));
      setRemaining(left);
      return left;
    };
    let done = false;
    const id = window.setInterval(() => {
      if (tick() <= 0 && !done) {
        done = true;
        window.clearInterval(id);
        if (refreshAtZero) router.refresh();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [target, serverNow, refreshAtZero, router]);

  return (
    <time
      dateTime={target.toISOString()}
      className={className}
      // Nur Screenreader-Nutzer, die nachfragen, hören die Zeit; kein Vorlesen jede Sekunde.
      aria-live="off"
    >
      <span className="tabular-nums">{formatCountdown(remaining)}</span>
    </time>
  );
}
