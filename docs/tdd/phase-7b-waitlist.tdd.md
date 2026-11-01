# TDD-Nachweis Phase 7b: Warteliste

**Quelle:** `docs/PLAN.md` (1.6 Warteliste, Phase 7 in Abschnitt 5).
**ECC:**

- Skill: `tdd-workflow`
- Review durch den Agenten `code-reviewer`
- Prüfung im Browser: `browser-qa`

## User Journeys

- Als Kunde trage ich mich bei einem ausverkauften Drop mit E-Mail und gewünschter Anzahl auf die Warteliste ein.
- Werden durch Storno oder abgelaufene Reservierungen genug Slots am Stück frei, bekomme ich eine Mail. Wer zuerst bucht, bekommt die Slots.
- Als Kunde trage ich mich per Link in der Mail und Knopf wieder aus.

## Entscheidungen

- **Ein Cron für Storno und Ablauf** (`/api/cron/warteliste`, alle 5 Minuten im bestehenden GitHub-Workflow).
  - Reservierungen verfallen ohne eigenes Ereignis (`reservedUntil`). Der Cron liest deshalb die aktuelle Verfügbarkeit, statt auf Ereignisse zu warten.
  - Drop-Alarm und Warteliste teilen sich den Ablauf (`runMailCron`: Zugang, Pause, 503 bei Störung).
- **Reihenfolge mit konkreten Slots.**
  - Älteste Einträge zuerst. Jeder bekommt gedanklich die früheste passende Slotfolge. Wer nicht passt, wird übersprungen.
  - Zusammen höchstens so viele Pizzen, wie der Drop noch aufnimmt (`maxPizzasTotal`).
- **15 Minuten Vorsprung:** Slots frisch Benachrichtigter gelten als versprochen. Danach kommt der Nächste dran, falls die Slots noch frei sind.
- **Eintragen nur, wenn die Anzahl gerade nicht buchbar ist.** Sonst verweist die Seite auf die Buchung. Dadurch geht keine Mail an eine Adresse, die bei freien Slots eingetragen wurde.
- **Kein Double-Opt-in:** genau eine Mail pro Eintrag, und nur, wenn Slots frei werden. Beim Eintragen geht keine Mail hinaus.
- **Umgewandelt, solange die Buchung gilt.** Die Reservierung vermerkt die Bestellung am Eintrag. Verfällt sie unbezahlt oder wird storniert, wartet der Eintrag wieder.
- **Datensparsamkeit:** Austragen löscht den Eintrag. Der Cron löscht Einträge vergangener und abgesagter Drops.
- **Exklusiver 10-min-Link (optional im Plan): noch nicht umgesetzt.**
- **Migration** `20261101180000_waitlist`:
  - `WaitlistEntry.token` für den Austragen-Link.
  - Indizes aus dem Review 2.3: `EmailLog(kind, createdAt)` und `Subscriber(status, confirmedAt)`.
  - Kein `text_pattern_ops`: Prisma meldet Indizes mit raw-ops bei jedem Abgleich als Abweichung. Der Drop-Alarm sucht stattdessen über exakte Schlüssel (Unique-Index).

## RED → GREEN

| Schritt                                                            | RED                                                        | GREEN                             |
| ------------------------------------------------------------------ | ---------------------------------------------------------- | --------------------------------- |
| Auswahlregel, Eintragen, Austragen, Cron                           | `3710e2c`: 16 Tests schlagen fehl („noch nicht umgesetzt“) | `641cb41`: 7 Unit, 9 Integration  |
| Aufräumen vergangener und abgesagter Drops                         | `4c8ac37`: 1 Integrationstest schlägt fehl                 | `dbc7e76`: 10 Integrationstests   |
| Review: nur wenn nicht buchbar, konkrete Slots, verfallene Buchung | `f4c2404`: 8 Unit- und 3 Integrationstests schlagen fehl   | `f3d0244`: 9 Unit, 11 Integration |

Der E2E-Test fand einen Fehler, den Unit- und Integrationstests nicht sehen konnten: Das Formular stand im Bestellformular, verschachtelte Formulare verwirft der Browser (`05d52e3`).

## Was die Tests garantieren

| #   | Garantie                                                                                                          | Test                                             | Art         |
| --- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ----------- |
| 1   | Reihenfolge; nicht Passende übersprungen; Slots am Stück; frühester Backbeginn; Obergrenze                        | `src/lib/domain/waitlist.test.ts`                | Unit        |
| 2   | Versprochene Slots werden nicht doppelt vergeben; zwei Wünsche teilen sich keinen Block                           | › entriesToNotify                                | Unit        |
| 3   | Eintragen mit 32-Byte-Schlüssel, normalisierter Adresse; nur Anzahl 1 bis Bestelllimit; nur Drops im Verkauf      | `src/lib/marketing/waitlist.integration.test.ts` | Integration |
| 4   | Eintragen nur, wenn die Anzahl nicht buchbar ist; nach Benachrichtigung ändert ein erneuter Versuch nichts        | › joinWaitlist                                   | Integration |
| 5   | Austragen löscht; zweiter Klick findet nichts                                                                     | › leaveWaitlist                                  | Integration |
| 6   | Storno gibt Slots frei → passender Eintrag bekommt Mail; Vorsprung 15 min; danach der Nächste                     | › sendDueWaitlistNotices                         | Integration |
| 7   | Gebuchte Einträge bekommen nichts, solange die Buchung gilt; nach Verfall wieder                                  | › sendDueWaitlistNotices                         | Integration |
| 8   | Übersprungene Mails nicht als benachrichtigt; nur Drops im Verkauf; Limit pro Lauf; Aufräumen alter Einträge      | › sendDueWaitlistNotices                         | Integration |
| 9   | Eintragen auf der Drop-Seite, Austragen per Knopf (Öffnen allein reicht nicht), Schlüssel danach nicht in der URL | `e2e/waitlist.spec.ts` (mobil und Desktop)       | E2E         |
| 10  | Cron ohne Schlüssel 401, ohne Resend-Schlüssel 503                                                                | `e2e/waitlist.spec.ts`                           | E2E         |

## Befehle und Ergebnisse (zuletzt ausgeführt)

- `npm test`: 204 Tests bestanden
- `npm run test:integration`: 54 Tests bestanden
- `npx playwright test`: 44 bestanden, 4 übersprungen
- `npm run typecheck`, `npm run lint`: sauber

## browser-qa (lokal)

- axe-core (WCAG 2.2 AA, lokal aus `node_modules`) auf ausverkaufter Drop-Seite mit Formular, Austragen-Seite mit Knopf und Bestätigung: 0 Verstöße, mobil und Desktop
- Mobil (375 px): Formular einspaltig, Anzahl als Auswahl „1 Pizza“ bis „4 Pizzen“
- Eintragen im Browser: Statusmeldung erscheint ohne Neuladen

## Review und Umgang damit

- **Behoben:**
  - **Eintragen bei freien Slots** hätte fast sofort eine Mail an eine beliebige Adresse ausgelöst. Jetzt nur, wenn die Anzahl nicht buchbar ist.
  - **Vorsprung nur als Summe:** Frisch Benachrichtigte belegen jetzt konkrete Slots.
  - **Umwandlung schon bei Reservierung:** Verfällt die Reservierung, wartet der Eintrag wieder.
  - **Erneutes Eintragen** ändert benachrichtigte oder gebuchte Einträge nicht mehr.
- **Vor dem Push nötig:**
  - **Migration auf Produktion** vor dem Deploy. Vorher `SELECT count(*) FROM "WaitlistEntry"` auf `production` prüfen: Die neue Spalte ist `NOT NULL` ohne Vorgabewert.
  - **Datenschutzerklärung** (Phase 9): Das Formular verlinkt sie bereits.
- **Bewusst offen:**
  - **Kein exklusiver 10-min-Link.** Kommt bei Bedarf als eigener Schritt (Reservierung für den ersten Eintrag).
  - **Drop-Alarm mit `in`-Liste:** ein Schlüssel pro Abonnent. Ab etwa 30 000 Abonnenten muss die Abfrage in Stücke geteilt werden.
  - **Wer nach Verfall der eigenen Buchung neu eintragen will:** Die Anzahl bleibt die alte.
  - **Schutz pro Absender:** Pro-IP-Limit und Captcha folgen in Phase 10.
