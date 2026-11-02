# TDD-Nachweis Phase 9: Inhalte & Recht

**Quelle:** `docs/PLAN.md` (Phase 9 in Abschnitt 5).
**ECC:**

- Skill: `tdd-workflow`
- Review durch den Agenten `code-reviewer`
- Prüfung: Lighthouse (Accessibility, Best Practices, SEO) und axe über die E2E-Läufe

## User Journeys

- Als Admin trage ich unter `/admin/inhalte` die Betreiberangaben ein und pflege die Texte der Startseite und die FAQ.
- Als Besucher finde ich Impressum, Datenschutz, AGB und Allergene im Footer.
- Als Betreiber kann ich pushen, bevor das Impressum steht. Drop-Alarm und Warteliste erscheinen erst, wenn es vollständig ist.

## Entscheidungen (mit dem Nutzer abgestimmt)

- **Betreiberangaben im Admin** statt im Code. Pflicht sind Name, Anschrift und E-Mail.
  - Bis sie stehen, sind Drop-Alarm und Warteliste ausgeblendet.
  - Die Server-Actions lehnen dann ebenfalls ab.
- **Datenschutz und AGB als Entwurf:**
  - Abgeleitet aus dem, was der Code tatsächlich speichert und versendet.
  - Sichtbar als Entwurf markiert.
  - Vor dem Start rechtlich prüfen lassen; keine Rechtsberatung.
- **Keine Migration:** Die Inhalte liegen in der vorhandenen Tabelle `SiteContent` (Schlüssel `legal`, `landing`, `faq`). Ungültige Werte fallen auf die Vorgabe zurück.
- **Allergene** aus den aktiven Pizzen (14 Hauptallergene nach LMIV).
- **Vercel-Region `fra1`:** Die Datenbank liegt in Frankfurt. Ohne Angabe liefen die Funktionen in den USA (`iad1`).
- **`siteUrl()` für Metadaten, robots.txt und Sitemap:** wirft nie, Vorschau-Deployments zeigen auf sich selbst. Mails und Stripe nutzen weiter das strenge `appUrl()`.

## RED → GREEN

| Schritt                                           | RED                               | GREEN                     |
| ------------------------------------------------- | --------------------------------- | ------------------------- |
| Inhalte: Schemas, Impressum vollständig, Vorgaben | `cdc2e53`: 6 Unit-Tests scheitern | `d7eaf9c`: 6 Unit-Tests   |
| Review: Adresse für Metadaten wirft nie           | `c881d2a`: 3 Unit-Tests scheitern | `1682250`: 235 Unit-Tests |

## Was die Tests garantieren

| #   | Garantie                                                                                    | Test                                        | Art  |
| --- | ------------------------------------------------------------------------------------------- | ------------------------------------------- | ---- |
| 1   | Impressum vollständig nur mit Name, Anschrift und E-Mail; ohne Speicherung unvollständig    | `src/lib/content/schema.test.ts`            | Unit |
| 2   | Eingaben getrimmt, E-Mail geprüft, FAQ nur mit Frage und Antwort, genau drei Schritte       | › Schemas                                   | Unit |
| 3   | Gespeicherte Werte, sonst die Vorgabe (fehlend oder kaputt)                                 | › parseContent                              | Unit |
| 4   | Adresse aus APP_URL, Vercel-Produktion, Vercel-Deployment, sonst localhost – nie ein Fehler | `src/lib/site-url.test.ts`                  | Unit |
| 5   | Rechtsseiten mit Betreiberangaben, Entwurfshinweis, Footer-Link                             | `e2e/legal.spec.ts`                         | E2E  |
| 6   | Allergenübersicht; robots.txt sperrt persönliche Links; Sitemap listet Drops                | `e2e/legal.spec.ts`                         | E2E  |
| 7   | 404 mit Weg zurück; Admin pflegt FAQ, die auf der Startseite erscheint                      | `e2e/legal.spec.ts`                         | E2E  |
| 8   | Drop-Alarm und Warteliste weiter nutzbar bei vollständigem Impressum                        | `e2e/alarm.spec.ts`, `e2e/waitlist.spec.ts` | E2E  |

## Befehle und Ergebnisse (zuletzt ausgeführt)

- `npm test`: 235 Tests bestanden
- `npm run test:integration`: 72 Tests bestanden
- `npx playwright test`: 65 bestanden, 5 übersprungen
- `npm run typecheck`, `npm run lint`: sauber

## Lighthouse (lokal, Produktions-Build, mobil)

- **Startseite:** Accessibility 100, Best Practices 100, SEO 100
- **`/datenschutz`:** Accessibility 100, Best Practices 100, SEO 100
- Die Performance misst dieses Werkzeug nicht. Sie folgt in Phase 10 mit einem Trace.

## Review und Umgang damit

- **Behoben:**
  - **Build-Abbruch möglich (HIGH):** Die Metadaten riefen `appUrl()` beim Laden auf, und das wirft ohne `APP_URL`. Jetzt nutzen sie `siteUrl()`.
  - **Datenschutz präzisiert:**
    - Kundendatensatz über Bestellungen hinweg
    - genaue Daten an Stripe (Positionen, Rabatt, Kennung)
    - Nachweis nach Widerruf des Drop-Alarms
    - Bewertungen bleiben an der Bestellung
    - Mail-Protokoll ohne Inhalt
    - Speicher auf den Küchengeräten
  - **Admin:** Fehlermeldung statt Fehlerseite, wenn das Speichern scheitert.
  - **FAQ:** Ein Pfeil zeigt Auf/Zu nicht nur über die Farbe (WCAG 1.4.1), dazu ein Fokusrahmen.
- **Geprüft, korrekt:** AGB §4. Stornierte und erstattete Bestellungen geben den Gutschein frei.
- **Vor dem Start prüfen (Nutzer):**
  - **Datenschutz und AGB rechtlich prüfen lassen.**
  - **Auftragsverarbeitung:** Die Datenschutzerklärung nennt Verträge mit Vercel und Neon. Prüfen, dass sie bestehen (bei beiden Teil der Nutzungsbedingungen bzw. DPA im Konto).
  - **Löschfristen:** Für Mail-Protokoll, abgemeldete und unbestätigte Abonnenten gibt es noch keine automatische Löschung. Der Text verspricht keine; ein Aufräum-Cron fehlt noch.
  - **Warteliste:** „spätestens nach dem Drop gelöscht“ gilt nur, solange der GitHub-Cron läuft.
- **Bewusst offen:**
  - **Bestellungen ohne Impressum:** Die Bestellung selbst ist nicht an das Impressum gebunden. Produktion bestellt heute schon (Stripe-Sandbox).
  - **Rechtsseiten ohne Angaben:** Solange nur der Hinweis „wird ergänzt“ dasteht, sind sie trotzdem indexierbar.
