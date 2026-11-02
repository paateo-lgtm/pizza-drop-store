import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { LegalPage, LegalPending } from "@/components/legal-page";
import { isLegalComplete } from "@/lib/content/schema";
import { getContent } from "@/lib/content/store";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Allgemeine Geschäftsbedingungen",
};

/** Entwurf; die Regeln entsprechen dem Ablauf im Shop (Reservierung, Zahlung, Abholung). */
export default function TermsPage() {
  return (
    <LegalPage
      title="Allgemeine Geschäftsbedingungen"
      updated="November 2026"
      draft
    >
      <Suspense>
        <Terms />
      </Suspense>
    </LegalPage>
  );
}

async function Terms() {
  await connection();
  const [legal, settings] = await Promise.all([
    getContent("legal"),
    getSettings(),
  ]);
  if (!isLegalComplete(legal)) return <LegalPending />;
  return (
    <>
      <h2>1. Geltungsbereich</h2>
      <p>
        Diese Bedingungen gelten für alle Bestellungen über diese Website bei{" "}
        {legal.operatorName}, {legal.street}, {legal.postalCity} („wir“).
      </p>

      <h2>2. Drops, Slots und Vertragsschluss</h2>
      <p>
        Wir backen zu angekündigten Terminen („Drops“). Jede Pizza belegt einen
        Zeitabschnitt im Ofen („Slot“); eine Bestellung mit mehreren Pizzen
        belegt mehrere Slots hintereinander, die Abholzeit ist das Ende des
        letzten Slots.
      </p>
      <p>
        Mit dem Absenden der Bestellung reservieren wir die gewählten Slots für{" "}
        {settings.reservationMinutes} Minuten. Der Vertrag kommt zustande, wenn
        die Zahlung innerhalb dieser Zeit erfolgreich abgeschlossen ist; du
        erhältst dann eine Bestätigung per E-Mail. Ohne erfolgreiche Zahlung
        verfällt die Reservierung. Geht eine Zahlung erst nach Ablauf ein und
        sind die Slots inzwischen vergeben, erstatten wir sie vollständig.
      </p>

      <h2>3. Preise und Zahlung</h2>
      <p>
        Alle Preise sind Endpreise inklusive der gesetzlichen Mehrwertsteuer.
        Bezahlt wird vorab online über unseren Zahlungsdienstleister Stripe.
      </p>

      <h2>4. Gutscheine</h2>
      <p>
        Gutscheincodes gelten nur in ihrem angegebenen Zeitraum, im Rahmen ihrer
        Einlösegrenzen und gegebenenfalls nur für bestimmte Drops. Pro
        Bestellung ist ein Gutschein einlösbar. Eine Barauszahlung ist
        ausgeschlossen. Wird eine Bestellung storniert oder erstattet, kann der
        Gutschein erneut eingelöst werden, solange er gilt.
      </p>

      <h2>5. Abholung</h2>
      <p>
        Die Pizzen holst du zur bestätigten Abholzeit am angegebenen Abholort
        gegen Vorzeigen deines Abholcodes ab. Weil wir jede Pizza frisch für
        deinen Slot backen, können wir sie nicht länger warmhalten oder später
        ausgeben. Holst du nicht ab, besteht kein Anspruch auf Erstattung.
      </p>

      <h2>6. Kein Widerrufsrecht</h2>
      <p>
        Ein Widerrufsrecht besteht nicht, weil es sich um Speisen handelt, die
        schnell verderben und zu einem fest vereinbarten Termin zubereitet
        werden (§ 312g Abs. 2 Nr. 2 und Nr. 9 BGB).
      </p>

      <h2>7. Absage durch uns</h2>
      <p>
        Müssen wir einen Drop absagen oder eine Bestellung stornieren, etwa
        wegen eines technischen Defekts am Ofen, erstatten wir den gezahlten
        Betrag vollständig und informieren dich per E-Mail.
      </p>

      <h2>8. Allergene</h2>
      <p>
        Die enthaltenen Allergene findest du bei jeder Pizza und in der{" "}
        <Link href="/allergene" className="underline underline-offset-4">
          Allergenübersicht
        </Link>
        . In unserer Küche werden alle Zutaten verarbeitet; Spuren anderer
        Allergene können wir nicht ausschließen.
      </p>

      <h2>9. Haftung</h2>
      <p>
        Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei
        Verletzung von Leben, Körper oder Gesundheit. Bei leicht fahrlässiger
        Verletzung wesentlicher Vertragspflichten ist die Haftung auf den
        vorhersehbaren, vertragstypischen Schaden begrenzt.
      </p>

      <h2>10. Streitbeilegung</h2>
      <p>
        Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungs­
        verfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
      </p>
    </>
  );
}
