import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { formatLongDate, formatTime } from "@/lib/format";
import { loadPrepList, type PrepBasis } from "@/lib/kitchen/prep";
import { PrepTable, PrintButton } from "./prep-table";

export const metadata: Metadata = {
  title: "Vorbereitung",
  robots: { index: false },
};

const BASIS: Record<PrepBasis, string> = {
  history: "nach dem Verkauf früherer Drops",
  current: "nach dem bisherigen Verkauf dieses Drops",
  equal: "gleichmäßig auf alle Sorten (noch keine Verkäufe)",
};

export default function PrepPage(
  props: PageProps<"/kitchen/[dropId]/vorbereitung">,
) {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 print:max-w-none print:p-0">
      <Suspense
        fallback={
          <p className="text-lg text-ink-muted" role="status">
            Vorbereitungsliste lädt …
          </p>
        }
      >
        <Prep params={props.params} />
      </Suspense>
    </main>
  );
}

async function Prep({ params }: { params: Promise<{ dropId: string }> }) {
  const [, , { dropId }] = await Promise.all([
    requireUser("kitchen:use"),
    connection(),
    params,
  ]);
  const prep = await loadPrepList(dropId);
  if (!prep) notFound();
  const { drop, list, capacity, basis, bufferPercent } = prep;

  return (
    <>
      <div className="flex items-center justify-between gap-4 print:hidden">
        <Link
          href={`/kitchen/${drop.id}`}
          className="flex items-center gap-2 rounded-md p-3 text-ink-muted hover:text-foreground"
        >
          <ArrowLeft className="size-5" aria-hidden /> Zum Küchen-Board
        </Link>
        <PrintButton />
      </div>
      <header className="mt-4 print:mt-0">
        <p className="text-sm tracking-wide text-ink-muted uppercase">
          Vorbereitung · {formatLongDate(drop.bakeStartsAt)} ·{" "}
          {formatTime(drop.bakeStartsAt)}–{formatTime(drop.bakeEndsAt)}
        </p>
        <h1 className="mt-1 text-4xl print:text-3xl">{drop.title}</h1>
        <p className="mt-2 text-ink-muted">
          Ausverkauf: {capacity} Pizzen, verteilt {BASIS[basis]}. Puffer +
          {bufferPercent} % (in den Einstellungen änderbar).
        </p>
      </header>
      <PrepTable dropId={drop.id} list={list} bufferPercent={bufferPercent} />
    </>
  );
}
