# TDD-Nachweis Phase 2: Drops & Slots

**Quelle:** `docs/PLAN.md` (1.2 Drop-Verwaltung, 3.2 Slot-Modell). Die Journeys wurden in diesem Lauf daraus abgeleitet.
**ECC:** `tdd-workflow`, Review durch den Agenten `typescript-reviewer`

## User Journeys

- Als Admin lege ich einen Drop mit Backzeitraum und Zeit pro Pizza an und sehe sofort, wie viele Slots und Pizzen das ergibt und wann die erste und die letzte Abholung ist.
- Als Admin ordne ich Pizzen zu, optional mit eigenem Preis und Kontingent.
- Als Admin führe ich den Drop durch den Ablauf Entwurf → geplant → Verkauf offen → geschlossen → abgeschlossen. Ab Verkaufsstart ist das Raster fix.
- Als Admin oder in der Küche sperre ich freie, noch nicht begonnene Slots als Puffer und gebe sie wieder frei.
- Als Admin dupliziere ich einen Drop für nächste Woche, zur gleichen Uhrzeit und auch über die Zeitumstellung hinweg.

## RED → GREEN

| Schritt                                                                  | RED                                                                                                   | GREEN                         |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ----------------------------- |
| Domäne + Berliner Zeit                                                   | `5245d21`: vitest bricht ab, weil die Module `./time` und `./domain/drops` fehlen                     | `2c05857`: 46 neue Tests grün |
| Formular-Validierung                                                     | vitest bricht ab, weil das Modul `./drop` fehlt                                                       | 9 Tests grün                  |
| Nach dem Review: Slot-Obergrenze, laufender Slot, deutsche Fehlermeldung | „begrenzt das Raster auf … Slots“ und „meldet nicht-numerische Obergrenzen auf Deutsch“ schlagen fehl | 95 Unit-Tests grün            |

## Was die Tests garantieren

| #   | Garantie                                                                                                                                                                                      | Test                                             | Art  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---- |
| 1   | Ein geplanter Drop schaltet per Zeit weiter (geplant → Verkauf → geschlossen → läuft → abgeschlossen) und springt nie zurück. Entwurf und Absage bleiben stehen.                              | `src/lib/domain/drops.test.ts` › effectiveStatus | Unit |
| 2   | Bis Verkaufsstart ist das Raster änderbar, danach fix                                                                                                                                         | › isGridLocked                                   | Unit |
| 3   | Pro Status sind nur die vorgesehenen Aktionen erlaubt, unzulässige Übergänge geben `null`                                                                                                     | › dropActions, statusAfter                       | Unit |
| 4   | Vorschau: 15–20 Uhr bei 6 min = 50 Slots, erste Abholung 15:06, letzte 20:00; Obergrenze und Rest werden berücksichtigt                                                                       | › describeGrid                                   | Unit |
| 5   | Unstimmige Zeiten, eine Obergrenze über der Slotanzahl und mehr als 500 Slots werden am jeweiligen Feld abgelehnt                                                                             | › validateDropTimes                              | Unit |
| 6   | Slot-Zustand: frei, reserviert (Zahlung läuft), verkauft, gesperrt; abgelaufene, stornierte oder erstattete Bestellungen geben den Slot frei                                                  | › slotStatus                                     | Unit |
| 7   | Sperren geht nur bei freien oder gesperrten Slots, die noch nicht begonnen haben, und nicht in beendeten Drops                                                                                | › canToggleSlotBlock                             | Unit |
| 8   | Berliner Zeit wird gelesen und ausgegeben (MEZ und MESZ), ungültige Daten werden abgelehnt; Verschieben um Tage behält die Uhrzeit über die Zeitumstellung                                    | `src/lib/time.test.ts`                           | Unit |
| 9   | Das Formular wird zu UTC, Sekunden und Cent umgerechnet; Pizza-Zeilen, Duplikate, Preise und Kontingente werden geprüft                                                                       | `src/lib/validation/drop.test.ts`                | Unit |
| 10  | Anlegen mit Vorschau, Ablehnung einer zu hohen Obergrenze, Slot sperren (bleibt nach Neuladen erhalten), veröffentlichen und zurückziehen, duplizieren (die Kopie hat keine Sperren), löschen | `e2e/drops.spec.ts` (mobil und Desktop)          | E2E  |

## Befehle und Ergebnisse (zuletzt ausgeführt)

- `npm test`: 9 Testdateien, 95 Tests bestanden
- `npx playwright test`: 14 bestanden
- `npm run typecheck`, `npm run lint`, `npx prettier --check src e2e`: sauber
- `npm run build`: erfolgreich; die Drop-Seiten sind als Partial Prerender gebaut

## Review (typescript-reviewer) und Umgang damit

- **Behoben:**
  - `changeDropStatus`, `saveDrop` und `deleteDrop` prüfen den Zustand jetzt in der Transaktion, nach `SELECT … FOR UPDATE` auf die Drop-Zeile.
  - Eine Absage wird auch durch laufende Zahlungen blockiert.
  - Sperren, die nicht ins neue Raster passen, verhindern die Rasteränderung mit einer Meldung, statt still zu verschwinden.
  - Höchstens 500 Slots pro Drop.
  - Kurznamen von Kopien bleiben eindeutig und innerhalb der Längengrenze; ein P2002 wird abgefangen.
  - Ein Slot, der nach dem Neuaufbau des Rasters fehlt, ergibt eine Meldung statt eines Fehlers.
  - Inaktive Pizzen verhindern Veröffentlichen und Verkaufsstart.
  - Der Slot, der gerade im Ofen ist, lässt sich nicht sperren.
  - Nicht-numerische Eingaben bekommen deutsche Meldungen.
  - Fehler beim Sperren im Raster ergeben eine Meldung.
  - Das Audit-Protokoll enthält jetzt Änderungen an den Pizza-Zeilen.
- **Bewusst offen:**
  - Die Drop-Liste lädt alle Slots für das Slot-Band. Für die erwartete Anzahl an Drops reicht das; eine Aggregation folgt mit dem Reporting.
  - Doppeldeutige Uhrzeit bei der Rückstellung auf Winterzeit (02:00–03:00): Backzeiten liegen abends, daher tritt das praktisch nicht auf.
  - Die Änderung des Kurznamens bei veröffentlichten Drops: Die öffentliche Drop-Seite entsteht erst in Phase 3; dort kommt eine Sperre dazu.
