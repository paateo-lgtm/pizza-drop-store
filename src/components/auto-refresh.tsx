"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Lädt die Serverdaten der Seite in festen Abständen neu, z. B. bis der Zahlungs-Webhook
 * angekommen ist. Pausiert in Hintergrund-Tabs und hört nach `maxTimes` auf.
 */
export function AutoRefresh({
  everyMs,
  maxTimes = Infinity,
}: {
  everyMs: number;
  maxTimes?: number;
}) {
  const router = useRouter();
  useEffect(() => {
    let count = 0;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      count += 1;
      if (count > maxTimes) {
        window.clearInterval(id);
        return;
      }
      router.refresh();
    }, everyMs);
    return () => window.clearInterval(id);
  }, [everyMs, maxTimes, router]);
  return null;
}
