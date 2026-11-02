import type { ReactNode } from "react";
import type { Legal } from "@/lib/content/schema";

/** Gemeinsamer Rahmen der Rechtsseiten: lesbare Zeilenlänge, ruhige Typografie. */
export function LegalPage({
  title,
  updated,
  draft,
  children,
}: {
  title: string;
  /** Stand des Texts, z. B. „November 2026“ */
  updated?: string;
  /** Sichtbarer Hinweis, solange der Text nicht rechtlich geprüft ist */
  draft?: boolean;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 pt-10 pb-20 sm:px-8">
      <h1 className="text-5xl leading-tight">{title}</h1>
      {updated && (
        <p className="mt-2 text-sm text-ink-muted">Stand: {updated}</p>
      )}
      {draft && (
        <p
          role="note"
          className="mt-6 rounded-md border border-terracotta/40 bg-wash px-4 py-3 text-sm"
        >
          Entwurf: Dieser Text ist noch nicht rechtlich geprüft.
        </p>
      )}
      <div className="mt-10 flex flex-col gap-4 text-ink [&_h2]:mt-8 [&_h2]:text-3xl [&_h3]:mt-4 [&_h3]:text-xl [&_li]:ml-5 [&_li]:list-disc [&_p]:leading-relaxed [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1">
        {children}
      </div>
    </article>
  );
}

/** Betreiberanschrift als Block, wie sie Impressum und Datenschutz brauchen. */
export function OperatorAddress({ legal }: { legal: Legal }) {
  return (
    <p>
      {legal.operatorName}
      <br />
      {legal.street}
      <br />
      {legal.postalCity}
      <br />
      E-Mail: <a href={`mailto:${legal.email}`}>{legal.email}</a>
      {legal.phone && (
        <>
          <br />
          Telefon: {legal.phone}
        </>
      )}
    </p>
  );
}

/** Solange die Betreiberangaben fehlen: ehrlicher Hinweis statt halbleerer Seite. */
export function LegalPending() {
  return (
    <p>
      Die Angaben zum Betreiber werden gerade ergänzt. Bis dahin nehmen wir
      keine Anmeldungen zum Drop-Alarm oder zur Warteliste an.
    </p>
  );
}
