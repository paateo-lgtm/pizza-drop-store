import Link from "next/link";
import { Suspense } from "react";
import { PageHeader, PageSkeleton } from "./_components/page-header";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";

export default function AdminHome() {
  return (
    <>
      <PageHeader title="Übersicht" />
      <Suspense fallback={<PageSkeleton rows={2} />}>
        <Overview />
      </Suspense>
    </>
  );
}

async function Overview() {
  const user = await requireUser("reports:view");
  const [activePizzas, inactivePizzas, ingredients, team] = await Promise.all([
    db.pizza.count({ where: { active: true } }),
    db.pizza.count({ where: { active: false } }),
    db.ingredient.count(),
    db.user.count({ where: { active: true } }),
  ]);

  const tiles = [
    {
      label: "Aktive Pizzen",
      value: activePizzas,
      href: "/admin/pizzen",
      hint: `${inactivePizzas} inaktiv`,
    },
    { label: "Zutaten", value: ingredients, href: "/admin/zutaten" },
    { label: "Team", value: team, href: "/admin/team", hint: "aktive Zugänge" },
  ];

  return (
    <>
      <p className="-mt-6 mb-8 text-ink-muted">Hallo {user.name}.</p>
      <dl className="grid gap-px overflow-hidden rounded-md border border-line bg-[var(--line)] sm:grid-cols-3">
        {tiles.map((tile) => (
          <Link
            key={tile.label}
            href={tile.href}
            className="flex flex-col gap-1 bg-surface p-5 transition-colors hover:bg-wash"
          >
            <dt className="text-sm text-ink-muted">{tile.label}</dt>
            <dd className="font-serif text-4xl tabular-nums">{tile.value}</dd>
            {tile.hint && (
              <dd className="text-xs text-ink-muted">{tile.hint}</dd>
            )}
          </Link>
        ))}
      </dl>
      <p className="mt-10 max-w-prose text-sm text-ink-muted">
        Drops, Bestellungen, Kitchen-Mode und Reporting kommen in den nächsten
        Phasen dazu und erscheinen dann hier mit ihren Kennzahlen.
      </p>
    </>
  );
}
