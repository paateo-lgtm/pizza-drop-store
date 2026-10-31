import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { logout } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Küche", robots: { index: false } };

// Platzhalter bis Phase 5: zeigt, dass Login und Rolle funktionieren.
export default function KitchenHome() {
  return (
    <main className="kitchen flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-4 text-center text-foreground">
      <h1 className="text-5xl">Küche</h1>
      <Suspense fallback={<p className="text-ink-muted">Lädt …</p>}>
        <KitchenGreeting />
      </Suspense>
      <p className="max-w-md text-ink-muted">
        Der Kitchen-Mode für laufende Drops folgt in Phase 5. Bis dahin kannst
        du dir den Entwurf ansehen.
      </p>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/entwurf/kueche">Entwurf ansehen</Link>
        </Button>
        <form action={logout}>
          <Button variant="outline">Abmelden</Button>
        </form>
      </div>
    </main>
  );
}

async function KitchenGreeting() {
  const user = await requireUser("kitchen:use");
  return <p className="text-lg">Angemeldet als {user.name}</p>;
}
