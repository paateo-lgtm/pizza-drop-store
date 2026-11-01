"use client";

import { useEffect } from "react";

/**
 * Hält den Bildschirm an, solange die Seite sichtbar ist (Küche). Der Browser gibt die
 * Sperre beim Tab-Wechsel frei; beim Zurückkehren wird sie neu angefordert.
 */
export function WakeLock() {
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let active = true;

    async function request() {
      if (document.visibilityState !== "visible") return;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (active) {
          // Schnelle Tab-Wechsel: die vorige Sperre nicht verwaist liegen lassen.
          void lock?.release();
          lock = next;
        } else {
          void next.release();
        }
      } catch {
        // Akkusparmodus oder fehlende Berechtigung: Die Seite funktioniert trotzdem.
      }
    }

    void request();
    document.addEventListener("visibilitychange", request);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", request);
      void lock?.release();
    };
  }, []);

  return null;
}
