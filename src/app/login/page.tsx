import type { Metadata } from "next";
import { Suspense } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Anmelden",
  robots: { index: false },
};

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <Wordmark />
        <h1 className="mt-8 text-4xl">Team-Login</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Für Admin-Bereich und Küche.
        </p>
        {/* Das Formular liest das Rücksprungziel aus der URL und erscheint erst, wenn es
            bedienbar ist. So gibt es kein zweites, halb geladenes Formular. */}
        <Suspense fallback={<LoginFormSkeleton />}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}

function LoginFormSkeleton() {
  return (
    <div
      className="mt-8 flex flex-col gap-5"
      aria-busy="true"
      aria-label="Lädt"
    >
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="h-4 w-20 rounded bg-wash" />
          <div className="h-9 rounded-md bg-wash" />
        </div>
      ))}
      <div className="h-10 rounded-md bg-wash" />
    </div>
  );
}
