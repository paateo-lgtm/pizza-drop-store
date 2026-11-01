"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

/**
 * Lädt die Serverdaten der Seite neu, z. B. bis der Zahlungs-Webhook angekommen ist.
 * Der Abstand beginnt bei `everyMs` und wächst mit `growth` bis `maxEveryMs` (ohne
 * `growth` bleibt er fest). Pausiert in Hintergrund-Tabs; nach `maxTimes` zeigt es
 * `fallback`.
 */
export function AutoRefresh({
  everyMs,
  growth = 1,
  maxEveryMs = Infinity,
  maxTimes = Infinity,
  fallback,
}: {
  everyMs: number;
  growth?: number;
  maxEveryMs?: number;
  maxTimes?: number;
  fallback?: ReactNode;
}) {
  const router = useRouter();
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    let count = 0;
    let delay = everyMs;
    let id = 0;
    const tick = () => {
      // Offline würde router.refresh() hart neu laden und auf der Fehlerseite landen.
      if (document.visibilityState === "visible" && navigator.onLine) {
        count += 1;
        if (count > maxTimes) {
          setGaveUp(true);
          return;
        }
        router.refresh();
        delay = Math.min(delay * growth, maxEveryMs);
      }
      id = window.setTimeout(tick, delay);
    };
    id = window.setTimeout(tick, delay);
    // Wieder online: sofort aktualisieren statt bis zum nächsten Abstand warten.
    const now = () => router.refresh();
    window.addEventListener("online", now);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("online", now);
    };
  }, [everyMs, growth, maxEveryMs, maxTimes, router]);

  return gaveUp ? fallback : null;
}
