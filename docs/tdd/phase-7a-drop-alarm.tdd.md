# TDD-Nachweis Phase 7a: Drop-Alarm

**Quelle:** `docs/PLAN.md` (1.6 Drop-Alarm, Phase 7 in Abschnitt 5).
**ECC:**

- Skill: `tdd-workflow`
- Reviews durch die Agenten `security-reviewer` und `silent-failure-hunter`
- Prüfung im Browser: `browser-qa`

## User Journeys

- Als Kunde trage ich mich auf der Startseite für den Drop-Alarm ein, bestätige per Mail und bekomme eine Mail, sobald ein Drop in den Verkauf geht.
- Als Kunde melde ich mich mit einem Klick wieder ab (Link in jeder Mail oder direkt im Mailprogramm).

## Entscheidungen

- **Zeitsteuerung per GitHub Actions** (Entscheidung des Nutzers), alle 5 Minuten.
  - Die Endpunkte unter `/api/cron/*` erwarten `Authorization: Bearer <CRON_SECRET>`, genau wie Vercel Cron.
  - Ein späterer Wechsel zu Vercel Pro ist damit nur ein Eintrag in `vercel.json`.
- **Bestätigen und Abmelden per Knopf statt Link.**
  - Grund: Mail-Scanner öffnen Links automatisch und würden sonst bestätigen oder abmelden.
  - Danach wird ohne den Schlüssel in der Adresse weitergeleitet.
  - Für `/alarm` gilt `Referrer-Policy: no-referrer`.
- **One-Click-Abmeldung nach RFC 8058** (`List-Unsubscribe-Post`), nur per POST.
- **Keine Migration.**
  - Doppelversand verhindert das Mail-Protokoll (`drop-alarm:<drop>:<abonnent>`).
  - Die Version des Einwilligungstexts steht in `Subscriber.source`.

## RED → GREEN

| Schritt                            | RED                                                                    | GREEN                                |
| ---------------------------------- | ---------------------------------------------------------------------- | ------------------------------------ |
| Regeln und Cron-Zugang             | `32522e3`: vitest bricht ab, weil `./subscription` und `./cron` fehlen | `fa9331c`: 9 Tests grün              |
| Anmeldung und Versand gegen die DB | `fd84f59`: `test:integration` bricht ab, weil `./drop-alert` fehlt     | `b2706c6`: 6 Integrationstests grün  |
| Reviews: Zählung, Limit, Schutz    | `d01da85`: 5 neue Tests schlagen fehl                                  | `5a94bc2`: 11 Integrationstests grün |

## Was die Tests garantieren

| #   | Garantie                                                                                                                             | Test                                               | Art         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- | ----------- |
| 1   | Anmeldung: neu anlegen, offene erneut senden, nach Abmeldung neu starten, Bestätigte unverändert                                     | `src/lib/domain/subscription.test.ts`              | Unit        |
| 2   | Höchstens eine Bestätigungsmail pro Adresse und Tag; Alarm einmal pro Drop und Abonnent                                              | › Mail-Schlüssel                                   | Unit        |
| 3   | Alarm fällig nur während des Verkaufs (auch bei frühem Öffnen), nicht als Entwurf, abgesagt oder danach                              | › isAlertDue                                       | Unit        |
| 4   | Cron nur mit richtigem Bearer-Schlüssel von mindestens 32 Zeichen                                                                    | `src/lib/cron.test.ts`                             | Unit        |
| 5   | Double-Opt-in mit 32-Byte-Schlüssel; Bestätigung einmal; Abmeldung idempotent; Neustart mit neuem Schlüssel                          | `src/lib/marketing/drop-alert.integration.test.ts` | Integration |
| 6   | Alarm nur an Bestätigte, nur für Drops im Verkauf, einmal; Limit pro Lauf, der nächste Lauf macht weiter                             | › sendDueDropAlerts                                | Integration |
| 7   | Übersprungene und gescheiterte Mails werden gezählt; jeder Versuch zählt zum Limit; wer sich mitten im Lauf abmeldet, bekommt nichts | › Review                                           | Integration |
| 8   | Stundenbudget für Bestätigungsmails; Version des Einwilligungstexts gespeichert                                                      | › Review                                           | Integration |
| 9   | Anmelden, Bestätigen per Knopf (Öffnen allein bestätigt nicht), Schlüssel danach nicht in der Adresse, Abmelden                      | `e2e/alarm.spec.ts` (mobil und Desktop)            | E2E         |
| 10  | Falscher Link zeigt Hinweis; One-Click-Abmeldung nur per POST; Cron ohne Schlüssel 401, ohne Resend-Schlüssel 503                    | `e2e/alarm.spec.ts`                                | E2E         |

## Befehle und Ergebnisse (zuletzt ausgeführt)

- `npm test`: 197 Tests bestanden
- `npm run test:integration`: 43 Tests bestanden
- `npx playwright test`: 42 bestanden, 4 übersprungen
- `npm run typecheck`, `npm run lint`, `npx prettier --check src e2e`: sauber

## browser-qa (lokal)

- axe-core (WCAG 2.2 AA) auf Startseite mit Formular, Bestätigungs- und Abmeldeseite: 0 Verstöße, mobil und Desktop
- Ungültige E-Mail wird schon im Browser abgefangen
- **Konsole:** 404 für die Footer-Links `/impressum`, `/datenschutz` und `/agb`. Die Seiten gibt es noch nicht (Phase 9).

## Reviews und Umgang damit

- **Behoben:**
  - **Versand ehrlich melden:** Ohne Resend-Schlüssel oder wenn nur Fehler kommen, antwortet der Cron mit 503. Dann wird der GitHub-Lauf rot und GitHub schickt eine Fehlermail.
  - **Versand im Lauf:**
    - Jeder Versuch zählt zum Limit.
    - Nach jedem Versuch gibt es eine Pause, auch nach Fehlern.
    - Pro Lauf gilt ein Zeitbudget.
    - Vor jeder Mail wird geprüft, ob sich jemand inzwischen abgemeldet hat.
    - `curl` wiederholt Anfragen im Workflow.
  - **Anmeldung:**
    - Sie läuft nach der Antwort (`after()`), daher gleiche Antwort und gleiche Antwortzeit für jede Adresse.
    - Ein Stundenbudget von 30 Bestätigungsmails insgesamt.
    - Ein Honeypot-Feld.
  - **Kleineres:**
    - Kein Zeilenumbruch im Betreff.
    - Eine Fehlerseite statt eines Absturzes.
    - Kein Doppelabsenden des Formulars, Fehler als Alert.
- **Vor dem öffentlichen Start nötig (Phase 9/10):**
  - **Datenschutzerklärung:** Das Formular verlinkt sie bereits.
  - **Schutz pro Absender:** Pro-IP-Limit und Captcha (z. B. Turnstile) für die Anmeldung.
  - **Eigene Absenderdomain bei Resend:** Ohne sie stellt Resend nur an die eigene Adresse zu.
  - **Resend-Kontingent:** Ein Plan mit mehr als 100 Mails pro Tag, wenn die Liste wächst.
- **Bewusst offen:**
  - **Wiederholungen bei abgelehnten Adressen:** Eine dauerhaft abgelehnte Adresse wird jeden Lauf erneut versucht. Eine Höchstzahl braucht eine Migration (Zähler im Mail-Protokoll).
  - **Unbestätigte Anmeldungen:** Löschen nach 7 Tagen kommt mit dem Aufräum-Cron.
  - **Einwilligungsverlauf:** Er wird beim Neustart nach einer Abmeldung überschrieben, es gibt keine Historientabelle.
  - **Schlüssel in Protokollen:** Er steht in den Vercel-Anfrageprotokollen der Links. Das Klick-Tracking von Resend muss aus bleiben (Standard).
  - **Cron-Pausen bei GitHub:** Geplante Workflows pausieren nach 60 Tagen ohne Aktivität im Repository.
