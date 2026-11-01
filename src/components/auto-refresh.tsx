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
      if (document.visibilityState !== "visible") return;
      count += 1;
      if (count > maxTimes) {
        window.clearInterval(id);
        setGaveUp(true);
        return;
      }
      router.refresh();
    }, everyMs);
    return () => window.clearInterval(id);
  }, [everyMs, maxTimes, router]);

  return gaveUp ? fallback : null;
}
