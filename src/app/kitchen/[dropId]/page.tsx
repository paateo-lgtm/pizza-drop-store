import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { WakeLock } from "@/components/wake-lock";
import { requireUser } from "@/lib/auth/dal";
import { loadKitchenBoard } from "@/lib/kitchen/kitchen";
import { LiveKitchenBoard } from "./live-board";

export const metadata: Metadata = { title: "Küche", robots: { index: false } };

export default function KitchenDropPage(props: PageProps<"/kitchen/[dropId]">) {
  return (
    <Suspense
      fallback={
        <p className="p-8 text-lg text-ink-muted" role="status">
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
      <LiveKitchenBoard initial={board} />
      <WakeLock />
    </>
  );
}
