"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

/**
 * Lädt die Serverdaten der Seite in festen Abständen neu, z. B. bis der Zahlungs-Webhook
 * angekommen ist. Pausiert in Hintergrund-Tabs; nach `maxTimes` zeigt es `fallback`.
 */
export function AutoRefresh({
  everyMs,
  maxTimes = Infinity,
  fallback,
}: {
  everyMs: number;
  maxTimes?: number;
  fallback?: ReactNode;
}) {
  const router = useRouter();
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    let count = 0;
    const id = window.setInterval(() => {
      // Offline würde router.refresh() hart neu laden und auf der Fehlerseite landen.
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      count += 1;
      if (count > maxTimes) {
        window.clearInterval(id);
        setGaveUp(true);
        return;
      }
      router.refresh();
    }, everyMs);
    // Wieder online: sofort aktualisieren statt bis zu everyMs warten.
    const now = () => router.refresh();
    window.addEventListener("online", now);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("online", now);
    };
  }, [everyMs, maxTimes, router]);

  return gaveUp ? fallback : null;
}
