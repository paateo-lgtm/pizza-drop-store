# TDD-Nachweis Phase 10 Teil 1: Löschfristen und One-Click-Widerspruch

**Quelle:** `docs/PLAN.md` (Phase 10 in Abschnitt 5) und die offenen Punkte aus Phase 7d.
**ECC:**

- Skill: `tdd-workflow`
- Review durch den Agenten `security-reviewer` (Modell sonnet, nur lesend)

## User Journeys

- **Datensparsamkeit:** Als Betreiber muss ich personenbezogene Daten nach den Fristen der Datenschutzerklärung löschen, ohne daran zu denken.
- **Abmelden im Mailprogramm:** Als Kundin klicke ich in meinem Mailprogramm auf „Abbestellen“ und bekomme keine Feedback-Anfragen mehr.

## Entscheidungen

- **`EmailLog` nach 90 Tagen löschen.**
  - Der Doppelversand-Schutz braucht es danach nicht mehr: Feedback läuft höchstens 72 h nach der Abholung, Alarm und Warteliste nur im laufenden Verkauf.
  - Das Stundenbudget für Bestätigungsmails zählt nur die letzte Stunde.
  - Folge: Die Admin-Bestellseite zeigt den Mailverlauf nur 90 Tage. Ein manuelles „Mail erneut senden“ danach verschickt die Mail wieder. Das ist vertretbar.
- **Nie bestätigte Drop-Alarm-Anmeldungen nach 30 Tagen löschen.**
  - Eine erneute Anmeldung gilt als neu und setzt `createdAt`, damit die Frist von vorn beginnt.
- **Bestätigte und abgemeldete Abonnenten bleiben.** Die Datenschutzerklärung verspricht, Adresse und Zeitpunkt des Widerrufs als Nachweis zu behalten. Löschen nur auf Wunsch.
- **Wartelisten-Einträge** löscht schon der Warteliste-Cron (vergangene und abgesagte Drops). Hier ist nichts zu tun.
- **Cron:** `/api/cron/aufraeumen` als vierter Schritt in `.github/workflows/cron.yml`, mit `CRON_SECRET` wie die übrigen Crons. Bei den Datenmengen reicht ein Lauf alle 5 Minuten.
- **Feedback-Mail:**
  - `List-Unsubscribe` und `List-Unsubscribe-Post` nach RFC 8058, wie beim Drop-Alarm.
  - `/api/feedback/abmelden` nimmt die Einwilligung nur per POST zurück, mit dem zweckgebundenen HMAC-Schlüssel der Feedback-Links.
  - Ein GET löst nichts aus, weil Link-Vorschauen und Mail-Scanner sonst widersprechen würden.
- **Datenschutzerklärung** nennt beide Fristen (Abschnitte 7 und 10).
- **Keine Migration.**

## RED → GREEN

| Schritt                                         | RED                                                    | GREEN     |
| ----------------------------------------------- | ------------------------------------------------------ | --------- |
| Aufräumen, Cron-Route, One-Click-Widerspruch    | `4d14e3f`: 2 Integrationstests und 2 E2E schlagen fehl | `e489986` |
| Review: erneute Anmeldung würde sofort gelöscht | `3b69748`: 1 Integrationstest schlägt fehl             | `bb123df` |

## Was die Tests garantieren

| #   | Garantie                                                                                   | Test                                              | Art         |
| --- | ------------------------------------------------------------------------------------------ | ------------------------------------------------- | ----------- |
| 1   | Alte `EmailLog`-Zeilen und nie bestätigte Anmeldungen werden gelöscht; frische bleiben     | `src/lib/maintenance/cleanup.integration.test.ts` | Integration |
| 2   | Bestätigte und abgemeldete Abonnenten bleiben; ein zweiter Lauf ändert nichts              | › cleanupPersonalData                             | Integration |
| 3   | Eine erneute Anmeldung nach über 30 Tagen überlebt den Lauf                                | › cleanupPersonalData                             | Integration |
| 4   | Der Cron verlangt den Schlüssel und meldet die gelöschten Mengen                           | `e2e/cleanup.spec.ts`                             | E2E         |
| 5   | One-Click-Widerspruch nur per POST; falscher Schlüssel 404; danach keine Einwilligung mehr | `e2e/feedback.spec.ts`                            | E2E         |

Die Kopfzeilen der Feedback-Mail selbst prüft kein Test, weil der Versand über Resend läuft. Sie sind im Review geprüft (keine Header-Injection: `orderId` kodiert, Schlüssel base64url).

## Review-Befunde

| Befund                                                                | Schwere | Ergebnis                       |
| --------------------------------------------------------------------- | ------- | ------------------------------ |
| Erneute Anmeldung nach über 30 Tagen wurde sofort wieder gelöscht     | MITTEL  | behoben (`bb123df`)            |
| Mailverlauf der Bestellung nach 90 Tagen weg, Neuversand dann möglich | NIEDRIG | belassen, siehe Entscheidungen |

## Ergebnis

- Unit 257, Integration 81, E2E 73 bestanden (5 übersprungen)
- Typecheck, ESLint und Prettier sauber
