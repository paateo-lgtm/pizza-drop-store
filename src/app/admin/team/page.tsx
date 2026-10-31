import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { PageHeader, PageSkeleton } from "../_components/page-header";
import { TeamManager } from "./team-manager";

export const metadata: Metadata = { title: "Team" };

export default function TeamPage() {
  return (
    <>
      <PageHeader
        title="Team"
        description="Admins verwalten alles, die Küche sieht nur Kitchen-Mode und Bestellungen."
      />
      <Suspense fallback={<PageSkeleton rows={3} />}>
        <Team />
      </Suspense>
    </>
  );
}

async function Team() {
  const me = await requireUser("team:manage");
  const members = await db.user.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  return <TeamManager members={members} currentUserId={me.id} />;
}
