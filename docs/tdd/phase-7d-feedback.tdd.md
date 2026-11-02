# TDD-Nachweis Phase 7d: Feedback nach Abholung

**Quelle:** `docs/PLAN.md` (1.6 Feedback nach Abholung, Phase 7 in Abschnitt 5).
**ECC:**

- Skill: `tdd-workflow`
- Review durch den Agenten `code-reviewer`
- Prüfung im Browser: `browser-qa`

## User Journeys

- Als Kunde, der im Checkout zugestimmt hat, bekomme ich einige Stunden nach der Abholung eine Mail mit persönlichem Link und vergebe 1–5 Sterne und optional einen Kommentar.
- Als Kunde widerspreche ich weiteren Feedback-Anfragen mit einem Klick (Link in jeder Mail, dann Knopf).
- Als Admin sehe ich unter `/admin/feedback` den Durchschnitt pro Drop und die einzelnen Bewertungen.

## Entscheidungen

- **Keine Migration:** `Feedback`, `Order.feedbackConsent` und `Order.pickedUpAt` gab es schon.
- **Nur mit Einwilligung** aus dem Checkout, weil Feedback-Anfragen nach BGH-Rechtsprechung als Werbung gelten.
- **Zeitfenster:** gefragt wird 3 h bis 72 h nach der Abholung, einmal pro Bestellung (Mail-Protokoll `feedback:<bestellung>`). Alte Bestellungen bekommen beim Start der Funktion keine Mail.
- **Persönlicher Link per HMAC** mit eigenem Zweck (`feedback:` statt `order-link:`). Kein gespeichertes Token. Der Bestell-Link öffnet kein Feedback und umgekehrt.
- **Bewertung:** einmal pro Bestellung, bis 30 Tage nach der Abholung. Doppeltes Absenden fängt der Unique-Index auf `Feedback.orderId` ab.
- **Widerspruch** gilt für alle Bestellungen derselben Adresse. Eine neue Bestellung fragt wieder per Checkbox.
- **Cron** `/api/cron/feedback` als dritter Schritt im GitHub-Workflow, mit demselben Ablauf wie Drop-Alarm und Warteliste (`runMailCron`).
- **Bewusst weggelassen:** Sterne pro Pizza (im Plan optional), eine Reporting-Seite (Phase 8).

## RED → GREEN

| Schritt                                              | RED                                                  | GREEN                              |
| ---------------------------------------------------- | ---------------------------------------------------- | ---------------------------------- |
| Zeitfenster, Link, Anfrage, Bewertung, Widerspruch   | `d8033fe`: 8 Unit- und 5 Integrationstests scheitern | `d14759e`: 226 Unit, 5 Integration |
| Review: neue vor gescheiterten Anfragen, Nullzeichen | `e0e0513`: 2 Integrationstests scheitern             | `b35e22f`: 7 Integration           |

## Was die Tests garantieren

| #   | Garantie                                                                                                                               | Test                                             | Art         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ----------- |
| 1   | Anfrage nur mit Einwilligung, nur abgeholt, ohne Bewertung, 3 h bis 72 h nach Abholung                                                 | `src/lib/domain/feedback.test.ts`                | Unit        |
| 2   | Bewertung offen bis 30 Tage, einmal, nur nach Abholung; eine Anfrage pro Bestellung                                                    | › feedbackState, feedbackMailKey                 | Unit        |
| 3   | Feedback-Schlüssel getrennt vom Bestell-Schlüssel                                                                                      | `src/lib/booking/order-link.test.ts`             | Unit        |
| 4   | Cron fragt einmal, nur Berechtigte; übersprungene werden wiederholt; neue vor gescheiterten                                            | `src/lib/marketing/feedback.integration.test.ts` | Integration |
| 5   | Bewertung gespeichert und getrimmt; zweite → erledigt; falscher Schlüssel, ungültige Sterne, zu lang, nicht abgeholt → abgelehnt       | › submitFeedback                                 | Integration |
| 6   | Widerspruch nur mit gültigem Schlüssel, für alle Bestellungen der Adresse; danach keine Anfrage mehr                                   | › withdrawFeedbackConsent                        | Integration |
| 7   | Bestellen mit Einwilligung, Bewerten per Link, zweiter Aufruf zeigt „erledigt“, fremder Schlüssel, Widerspruch per Knopf, Cron 401/503 | `e2e/feedback.spec.ts` (mobil und Desktop)       | E2E         |

## Befehle und Ergebnisse (zuletzt ausgeführt)

- `npm test`: 226 Tests bestanden
- `npm run test:integration`: 72 Tests bestanden
- `npx playwright test`: 56 bestanden, 4 übersprungen
- `npm run typecheck`, `npm run lint`: sauber

## browser-qa (lokal)

- axe-core (WCAG 2.2 AA, lokal aus `node_modules`) auf Feedback-Formular, Widerspruch, Danke-Ansicht und `/admin/feedback`: 0 Verstöße, mobil und Desktop.
- Sterne als Radiogruppe: per Tastatur bedienbar, Screenreader lesen „4 Sterne – Sehr gut“.

## Review und Umgang damit

- **Behoben:**
  - **Warteschlange (MEDIUM):** Dauerhaft abgelehnte Adressen standen vorn und verbrauchten das Limit pro Lauf. Jetzt kommen Bestellungen ohne bisherigen Versuch zuerst.
  - **Nullzeichen** im Kommentar werden entfernt (Postgres lehnt sie ab).
  - **Zu lange Kommentare** bekommen eine eigene Meldung statt „Bitte wähle 1 bis 5 Sterne“.
- **Bewusst offen:**
  - **Einwilligung ohne Zeitstempel und Textversion:** `feedbackConsent` ist nur ein Ja/Nein. Für den Nachweis wären `feedbackConsentAt` und die Version des Checkbox-Texts besser. Das braucht eine Migration, also mit der nächsten.
  - **Kein `List-Unsubscribe`-Header:** Die Mail hat den Widerspruchslink im Text. One-Click im Mailprogramm braucht einen POST-Endpunkt wie beim Drop-Alarm.
  - **Widerspruch während eines laufenden Versands:** Eine Mail, die gerade rausgeht (höchstens rund 45 s), kommt noch an.
  - **Wiederholungen für dauerhaft abgelehnte Adressen** laufen bis zum Ende des 72-h-Fensters weiter, jetzt aber hinter den neuen.
