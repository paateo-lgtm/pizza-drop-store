import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import {
  LegalPage,
  LegalPending,
  OperatorAddress,
} from "@/components/legal-page";
import { isLegalComplete } from "@/lib/content/schema";
import { getContent } from "@/lib/content/store";

export const metadata: Metadata = { title: "Datenschutz" };

/**
 * Entwurf, abgeleitet aus dem, was der Code tatsächlich speichert und versendet
 * (Stand Phase 9). Ändert sich die Verarbeitung, muss dieser Text mitziehen.
 */
export default function PrivacyPage() {
  return (
    <LegalPage title="Datenschutzerklärung" updated="November 2026" draft>
      <Suspense>
        <Privacy />
      </Suspense>
    </LegalPage>
  );
}

async function Privacy() {
  await connection();
  const legal = await getContent("legal");
  if (!isLegalComplete(legal)) return <LegalPending />;
  return (
    <>
      <h2>1. Verantwortlicher</h2>
      <OperatorAddress legal={legal} />
      <p>
        Für alle Fragen zum Datenschutz erreichst du uns unter der oben
        genannten E-Mail-Adresse.
      </p>

      <h2>2. Überblick</h2>
      <p>
        Wir verarbeiten personenbezogene Daten nur, soweit es für Bestellung,
        Abholung und die von dir gewünschten Benachrichtigungen nötig ist. Wir
        setzen keine Analyse- oder Werbe-Tools ein, binden keine Social-Media-
        Inhalte ein und setzen für Kundinnen und Kunden keine Cookies.
      </p>

      <h2>3. Aufruf der Website</h2>
      <p>
        Beim Aufruf verarbeitet unser Hoster technisch notwendige Daten (IP-
        Adresse, Zeitpunkt, aufgerufene Adresse, Browserkennung), um die Seite
        auszuliefern und Angriffe abzuwehren. Rechtsgrundlage ist unser
        berechtigtes Interesse an einem sicheren Betrieb (Art. 6 Abs. 1 lit. f
        DSGVO). Schriftarten liefern wir selbst aus; es findet kein Abruf bei
        Google statt.
      </p>

      <h2>4. Bestellung und Abholung</h2>
      <p>
        Für eine Bestellung speichern wir Name, E-Mail-Adresse, Telefonnummer,
        deine optionale Notiz, die bestellten Pizzen, die gewählte Abholzeit,
        einen Abholcode sowie Zahlungsstatus und Beträge. Die E-Mail-Adresse
        nutzen wir für Bestätigung, Storno und Erstattung, die Telefonnummer nur
        für Rückfragen zur Bestellung. Rechtsgrundlage ist die Erfüllung des
        Vertrags (Art. 6 Abs. 1 lit. b DSGVO).
      </p>
      <p>
        Zu deiner E-Mail-Adresse legen wir einen Kundendatensatz an (Name,
        Telefon, Zeitpunkt der ersten Bestellung), den weitere Bestellungen mit
        derselben Adresse wiederverwenden. Name und Telefon einer Bestellung
        stehen zusätzlich an der Bestellung selbst.
      </p>
      <p>
        Bestelldaten bewahren wir auf, solange handels- und steuerrechtliche
        Pflichten es verlangen (bis zu zehn Jahre, § 147 AO, § 257 HGB). Eine
        frühere Löschung des Kundendatensatzes kannst du jederzeit verlangen,
        soweit keine Aufbewahrungspflicht entgegensteht.
      </p>

      <h2>5. Zahlung über Stripe</h2>
      <p>
        Die Zahlung wickelt Stripe Payments Europe, Ltd. (Irland) ab. Dafür
        geben wir deine E-Mail-Adresse, eine interne Kennung der Bestellung, die
        bestellten Pizzen mit Preisen und einen eingelösten Rabatt weiter.
        Karten- und Kontodaten gibst du direkt bei Stripe ein; wir erhalten sie
        nicht. Bei uns gespeichert werden nur die Kennungen der Zahlung, um sie
        zuordnen und gegebenenfalls erstatten zu können. Rechtsgrundlage ist
        Art. 6 Abs. 1 lit. b DSGVO. Stripe kann Daten auch in den USA
        verarbeiten; die Übermittlung stützt sich auf das EU-US Data Privacy
        Framework bzw. Standardvertragsklauseln.
      </p>

      <h2>6. Gutscheine</h2>
      <p>
        Löst du einen Gutschein ein, speichern wir, welcher Gutschein zu welcher
        Bestellung gehört. So prüfen wir Einlösegrenzen, auch pro E-Mail-Adresse
        (Art. 6 Abs. 1 lit. b DSGVO).
      </p>

      <h2>7. Drop-Alarm</h2>
      <p>
        Trägst du dich für den Drop-Alarm ein, schicken wir dir zuerst eine Mail
        zur Bestätigung (Double-Opt-in). Erst danach informieren wir dich, wenn
        ein neuer Drop in den Verkauf geht. Wir speichern deine E-Mail-Adresse,
        den Zeitpunkt der Anmeldung und der Bestätigung sowie die Version des
        Einwilligungstexts als Nachweis. Rechtsgrundlage ist deine Einwilligung
        (Art. 6 Abs. 1 lit. a DSGVO). Du kannst sie jederzeit über den Link in
        jeder Mail widerrufen; danach schreiben wir dir nicht mehr. Adresse und
        Zeitpunkt des Widerrufs behalten wir als Nachweis, dass wir ihn
        beachten; auf Wunsch löschen wir sie vollständig.
      </p>

      <h2>8. Warteliste</h2>
      <p>
        Ist ein Drop ausverkauft, kannst du dich mit E-Mail-Adresse und
        gewünschter Anzahl auf die Warteliste setzen. Werden passende Slots
        frei, schreiben wir dir einmal. Rechtsgrundlage ist deine Anfrage (Art.
        6 Abs. 1 lit. b DSGVO). Den Eintrag löschen wir, wenn du dich über den
        Link in der Mail austrägst, spätestens aber nach dem Drop.
      </p>

      <h2>9. Bitte um Bewertung</h2>
      <p>
        Nur wenn du beim Bestellen zustimmst, bitten wir dich einige Stunden
        nach der Abholung einmal per Mail um eine Bewertung. Deine Sterne und
        dein Kommentar werden mit der Bestellung gespeichert und intern
        ausgewertet; wir veröffentlichen sie nicht. Rechtsgrundlage ist deine
        Einwilligung (Art. 6 Abs. 1 lit. a DSGVO). Du kannst ihr jederzeit über
        den Link in der Mail widersprechen. Eine abgegebene Bewertung bleibt mit
        der Bestellung gespeichert; auf Wunsch löschen wir sie.
      </p>

      <h2>10. Versand von E-Mails</h2>
      <p>
        Unsere Mails verschickt Resend (Plus Five Five, Inc., USA). Dafür
        übermitteln wir Empfängeradresse und Inhalt der Mail. Die Übermittlung
        in die USA stützt sich auf Standardvertragsklauseln. Wir protokollieren,
        welche Mail an welche Adresse ging, um Doppelversand zu vermeiden und
        den Versand nachweisen zu können (Art. 6 Abs. 1 lit. f DSGVO). Das
        Protokoll enthält nur Art, Empfängeradresse und Zeitpunkt, nicht den
        Inhalt der Mail.
      </p>

      <h2>11. Hosting und Datenbank</h2>
      <p>
        Die Website läuft bei Vercel Inc. (USA); die Anwendung ist in der Region
        Frankfurt am Main eingerichtet. Bilder der Pizzen liegen im Speicher von
        Vercel. Die Datenbank betreibt Neon, Inc. in einem Rechenzentrum in
        Frankfurt am Main. Mit beiden Anbietern bestehen Verträge zur
        Auftragsverarbeitung; Übermittlungen in die USA stützen sich auf das
        EU-US Data Privacy Framework bzw. Standardvertragsklauseln.
      </p>

      <h2>12. Cookies und lokaler Speicher</h2>
      <p>
        Für Kundinnen und Kunden setzen wir keine Cookies. Nur unser Team erhält
        beim Anmelden im Verwaltungsbereich ein technisch notwendiges
        Sitzungs-Cookie (§ 25 Abs. 2 TDDDG). Auf den Geräten in der Küche merkt
        sich der Browser, welche Zutaten auf der Vorbereitungsliste abgehakt
        sind; dabei werden keine personenbezogenen Daten gespeichert.
      </p>

      <h2>13. Deine Rechte</h2>
      <ul>
        <li>Auskunft über deine Daten (Art. 15 DSGVO)</li>
        <li>Berichtigung (Art. 16 DSGVO) und Löschung (Art. 17 DSGVO)</li>
        <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
        <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
        <li>
          Widerspruch gegen Verarbeitungen aus berechtigtem Interesse (Art. 21
          DSGVO)
        </li>
        <li>Widerruf erteilter Einwilligungen mit Wirkung für die Zukunft</li>
        <li>
          Beschwerde bei einer Datenschutz-Aufsichtsbehörde (Art. 77 DSGVO)
        </li>
      </ul>
      <p>
        Eine automatisierte Entscheidungsfindung oder ein Profiling findet nicht
        statt.
      </p>
    </>
  );
}
