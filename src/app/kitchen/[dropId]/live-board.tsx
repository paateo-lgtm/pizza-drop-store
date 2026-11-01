"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { KitchenBoard } from "@/lib/kitchen/kitchen";
import { loadBoardAction } from "../actions";
import { KitchenBoardView } from "./kitchen-board";

/** Mehrere Geräte bleiben über Polling synchron (docs/PLAN.md, 1.4). */
const POLL_MS = 3000;

/**
 * Hält das Board aktuell. Scheitert ein Abruf, bleibt der letzte Stand stehen;
 * das Board zeigt dann sein Alter (siehe StaleNotice) und läuft weiter, sobald
 * das Netz zurück ist.
 */
export function LiveKitchenBoard({ initial }: { initial: KitchenBoard }) {
  const [polled, setPolled] = useState<KitchenBoard | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const pathname = usePathname();
  const dropId = initial.drop.id;

  useEffect(() => {
    let active = true;
    async function load() {
      if (document.visibilityState !== "visible") return;
      try {
        const next = await loadBoardAction(dropId);
        if (!active) return;
        if (next === "signIn") setSignedOut(true);
        else if (next) {
          setSignedOut(false);
          setPolled(next);
        }
      } catch {
        // Kein Netz o. Ä.: alter Stand bleibt, die Warnung zeigt sein Alter.
      }
    }
    const id = window.setInterval(load, POLL_MS);
    document.addEventListener("visibilitychange", load);
    window.addEventListener("online", load);
    return () => {
      active = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", load);
      window.removeEventListener("online", load);
    };
  }, [dropId]);

  // Nach eigenen Aktionen kommt über refresh() ein neuerer Stand vom Server.
  const board =
    polled && polled.serverNow > initial.serverNow ? polled : initial;

  return (
    <>
      {signedOut && (
        <p
          role="alert"
          className="bg-terracotta px-6 py-3 text-lg font-semibold text-white"
        >
          Sitzung abgelaufen – die Anzeige ist nicht aktuell.{" "}
          <Link
            href={`/login?next=${encodeURIComponent(pathname)}`}
            className="underline underline-offset-4"
          >
            Neu anmelden
          </Link>
        </p>
      )}
      <KitchenBoardView board={board} />
    </>
  );
}
