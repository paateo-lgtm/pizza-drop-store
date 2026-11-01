import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { logout } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { effectiveStatus } from "@/lib/domain/drops";
import { formatLongDate, formatTime } from "@/lib/format";

export const metadata: Metadata = { title: "Küche", robots: { index: false } };

/** Drops, die bis vor drei Stunden noch gebacken wurden, bleiben in der Auswahl. */
const RECENT_MS = 3 * 60 * 60_000;

export default function KitchenHome() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10">
      <h1 className="text-5xl">Küche</h1>
      <Suspense fallback={<p className="text-ink-muted">Lädt …</p>}>
        <DropList />
      </Suspense>
      <form action={logout} className="mt-auto">
        <Button variant="outline">Abmelden</Button>
      </form>
    </main>
  );
}

async function DropList() {
  const user = await requireUser("kitchen:use");
  await connection();
  const now = new Date();
  const drops = await db.drop.findMany({
    where: {
      status: { notIn: ["DRAFT", "CANCELLED"] },
      bakeEndsAt: { gt: new Date(now.getTime() - RECENT_MS) },
    },
    orderBy: { bakeStartsAt: "asc" },
    take: 6,
    include: {
      _count: { select: { slots: { where: { ticket: { isNot: null } } } } },
    },
  });

  return (
    <section aria-labelledby="drops" className="flex flex-col gap-4">
      <p className="text-lg text-ink-muted">Angemeldet als {user.name}</p>
      <h2
        id="drops"
        className="font-sans text-sm font-semibold tracking-wide text-ink-muted uppercase"
      >
        Welcher Drop wird gebacken?
      </h2>
      {drops.length === 0 ? (
        <p className="rounded-md border border-line p-6 text-lg">
          Gerade steht kein Drop an. Neue Drops legt ein Admin unter „Drops“ an.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {drops.map((drop) => (
            <li key={drop.id}>
              <Link
                href={`/kitchen/${drop.id}`}
                className="flex items-center gap-4 rounded-md border border-line p-5 transition-colors hover:border-olive focus-visible:border-olive"
              >
                <span className="flex-1">
                  <span className="block font-serif text-3xl">
                    {drop.title}
                  </span>
                  <span className="text-ink-muted tabular-nums">
                    {formatLongDate(drop.bakeStartsAt)} ·{" "}
                    {formatTime(drop.bakeStartsAt)}–
                    {formatTime(drop.bakeEndsAt)} · {drop._count.slots} Pizzen
                    {effectiveStatus(drop, now) === "LIVE" && (
                      <span className="ml-2 font-semibold text-terracotta">
                        läuft
                      </span>
                    )}
                  </span>
                </span>
                <ChevronRight className="size-6" aria-hidden />
              </Link>
              <Link
                href={`/kitchen/${drop.id}/vorbereitung`}
                className="mt-1 inline-block rounded-md px-5 py-2 text-ink-muted underline-offset-4 hover:text-foreground hover:underline"
              >
                Vorbereitungsliste
                <span className="sr-only"> für {drop.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
