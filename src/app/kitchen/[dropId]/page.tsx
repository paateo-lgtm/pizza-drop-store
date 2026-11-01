import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import { WakeLock } from "@/components/wake-lock";
import { requireUser } from "@/lib/auth/dal";
import { loadKitchenBoard } from "@/lib/kitchen/kitchen";
import { KitchenBoardView } from "./kitchen-board";

export const metadata: Metadata = { title: "Küche", robots: { index: false } };

/** Mehrere Geräte bleiben über Polling synchron (docs/PLAN.md, 1.4). */
const POLL_MS = 3000;

export default function KitchenDropPage(props: PageProps<"/kitchen/[dropId]">) {
  return (
    <Suspense
      fallback={
        <p className="p-8 text-lg text-ink-muted" aria-busy="true">
          Küche lädt …
        </p>
      }
    >
      <Board params={props.params} />
    </Suspense>
  );
}

async function Board({ params }: { params: Promise<{ dropId: string }> }) {
  const [, , { dropId }] = await Promise.all([
    requireUser("kitchen:use"),
    connection(),
    params,
  ]);
  const board = await loadKitchenBoard(dropId);
  if (!board) notFound();
  return (
    <>
      <KitchenBoardView board={board} />
      <AutoRefresh everyMs={POLL_MS} />
      <WakeLock />
    </>
  );
}
