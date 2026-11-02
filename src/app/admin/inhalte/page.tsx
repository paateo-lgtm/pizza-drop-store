import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { isLegalComplete } from "@/lib/content/schema";
import { getContent } from "@/lib/content/store";
import { PageHeader, PageSkeleton } from "../_components/page-header";
import { FaqForm, LandingForm, LegalForm } from "./content-forms";

export const metadata: Metadata = { title: "Inhalte & Recht" };

export default function ContentPage() {
  return (
    <>
      <PageHeader
        title="Inhalte & Recht"
        description="Betreiberangaben für Impressum, Datenschutz und AGB sowie die Texte der Startseite."
      />
      <Suspense fallback={<PageSkeleton rows={6} />}>
        <Forms />
      </Suspense>
    </>
  );
}

async function Forms() {
  await requireUser("content:manage");
  const [legal, landing, faq] = await Promise.all([
    getContent("legal"),
    getContent("landing"),
    getContent("faq"),
  ]);
  const complete = isLegalComplete(legal);

  return (
    <div className="flex max-w-3xl flex-col gap-12">
      <Section
        title="Betreiber"
        description="Pflichtangaben für das Impressum. Erst wenn Name, Anschrift und E-Mail stehen, zeigt die Seite die Anmeldung zum Drop-Alarm und die Warteliste."
      >
        <p
          role="status"
          className={
            complete
              ? "rounded-md bg-wash px-3 py-2 text-sm text-olive"
              : "rounded-md bg-wash px-3 py-2 text-sm text-terracotta"
          }
        >
          {complete
            ? "Impressum vollständig – Drop-Alarm und Warteliste sind sichtbar."
            : "Impressum unvollständig – Drop-Alarm und Warteliste sind ausgeblendet."}
        </p>
        <LegalForm legal={legal} />
        <p className="text-sm text-ink-muted">
          Vorschau:{" "}
          <Link href="/impressum" className="underline underline-offset-4">
            Impressum
          </Link>
          ,{" "}
          <Link href="/datenschutz" className="underline underline-offset-4">
            Datenschutz
          </Link>
          ,{" "}
          <Link href="/agb" className="underline underline-offset-4">
            AGB
          </Link>
          . Datenschutz und AGB sind Entwürfe: Bitte vor dem Start rechtlich
          prüfen lassen.
        </p>
      </Section>

      <Section title="Startseite">
        <LandingForm landing={landing} />
      </Section>

      <Section
        title="Häufige Fragen"
        description="Erscheinen auf der Startseite unter „So funktioniert's“."
      >
        <FaqForm faq={faq} />
      </Section>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="border-b border-line pb-2">
        <h2 className="text-2xl">{title}</h2>
        {description && <p className="text-sm text-ink-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}
