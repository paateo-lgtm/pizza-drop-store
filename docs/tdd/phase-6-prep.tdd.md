# TDD-Nachweis Phase 6: Vorbereitungsliste

**Quelle:** `docs/PLAN.md` (1.5 Vorbereitungsliste, Phase 6 in Abschnitt 5).
**ECC:** `tdd-workflow`, `/ecc:code-review` (Agent `code-reviewer`), dazu `browser-qa`.

## User Journeys

- Als Küche sehe ich vor dem Drop, wie viele Teiglinge, Pizzen je Sorte und Zutaten ich brauche: für den aktuellen Verkauf, hochgerechnet auf den Ausverkauf und mit Puffer.
- Als Küche drucke ich die Liste aus oder hake Positionen auf dem Tablet ab.
- Als Admin stelle ich den Puffer in Prozent ein.

## Entscheidungen

- **Ort:** `/kitchen/[dropId]/vorbereitung` (Recht `kitchen:use`), damit auch die Küchenrolle sie sieht. Verlinkt aus Küchen-Board, Drop-Auswahl der Küche und Admin-Drop.
- **Hochrechnung „bei Ausverkauf“:**
  - Die Kapazität sind die freien (nicht gesperrten) Slots, gedeckelt durch die Obergrenze des Drops.
  - Der freie Rest wird verteilt nach dem Verkauf der letzten 10 gebackenen Drops.
  - Neue Sorten ohne Historie zählen dabei wie eine durchschnittliche Sorte.
  - Ohne jede Historie wird nach dem aktuellen Verkauf verteilt, ohne Verkauf gleichmäßig.
  - Kontingente pro Sorte deckeln; ihr Überschuss geht an die übrigen Sorten.
- **Puffer:** neue Einstellung `prepBufferPercent` (Standard 10 %), aufgerundet auf ganze Einheiten. Keine Migration nötig (Einstellungen sind Schlüssel/Wert).
- **Abhaken:** pro Gerät im Browser (localStorage), ohne Migration. Der Haken gehört zur Menge; ändert sie sich, ist die Position wieder offen. Für mehrere Personen gilt die Druckansicht.

## RED → GREEN

| Schritt                                              | RED                                                          | GREEN                                       |
| ---------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------- |
| Berechnung (`src/lib/domain/prep.ts`)                | `5c124c9`: vitest bricht ab, weil `./prep` fehlt             | `98c33fc`: 9 Tests grün                     |
| Laden aus der Datenbank (`src/lib/kitchen/prep.ts`)  | `9f6fd53`: `test:integration` bricht ab, weil `./prep` fehlt | `f141a67`: 2 Integrationstests grün         |
| Review: neue Sorte ohne Historie bekam keinen Anteil | `3a527d5`: Test schlägt fehl, die neue Sorte bleibt bei 0    | `5761a77`: zählt wie eine durchschnittliche |

## Was die Tests garantieren

| #   | Garantie                                                                                                             | Test                                       | Art         |
| --- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ----------- |
| 1   | Freie Kapazität nach früheren Drops verteilt; neue Sorten wie der Durchschnitt                                       | `src/lib/domain/prep.test.ts`              | Unit        |
| 2   | Ohne Historie nach aktuellem Verkauf, ohne Verkauf gleichmäßig (Rest nach Reihenfolge)                               | › projectSellOut                           | Unit        |
| 3   | Kontingente werden eingehalten, Überschuss geht an andere Sorten; bei erschöpften Kontingenten bleibt Kapazität frei | › projectSellOut                           | Unit        |
| 4   | Nie unter dem aktuellen Verkauf, auch über der Kapazität                                                             | › projectSellOut                           | Unit        |
| 5   | Teiglinge, Pizzen und Zutatenmengen (über Sorten summiert, nach Name sortiert) für verkauft, Ausverkauf, mit Puffer  | › prepList                                 | Unit        |
| 6   | Aus der Datenbank: Kapazität ohne gesperrte Slots, Historie aus früheren Drops, offene Reservierungen zählen nicht   | `src/lib/kitchen/prep.integration.test.ts` | Integration |
| 7   | Seite: Teiglinge und Pizzen für einen echten Verkauf, Drucken-Knopf, Abhaken übersteht das Neuladen                  | `e2e/prep.spec.ts` (Desktop)               | E2E         |

## Befehle und Ergebnisse (zuletzt ausgeführt)

- `npm test`: 188 Tests bestanden
- `npm run test:integration`: 32 Tests bestanden
- `npx playwright test`: 34 bestanden, 4 übersprungen (Küche nicht mobil)
- `npm run typecheck`, `npm run lint`, `npx prettier --check src e2e`: sauber

## browser-qa (lokal, Testdaten)

- axe-core (WCAG 2.2 AA): 0 Verstöße; keine Konsolenfehler, keine 4xx/5xx
- Bildschirm bei 375 und 1024 px lesbar; Druckansicht (`print`-Media) hell, ohne Navigation und Drucken-Knopf
- Visueller Vergleich: INCONCLUSIVE (keine Baseline)

## Review (`code-reviewer`) und Umgang damit

- **Geprüft und korrekt:** Die Verteilungsschleife terminiert. Kapazität = freie Slots ist richtig, da verkaufte Slots den Zustand FREE behalten. Die Decimal-Rundung stimmt, die Rechteprüfung auch.
- **Behoben:**
  - Neue Sorten in der Hochrechnung.
  - Haken an die Menge gebunden.
  - Historie auf die letzten 10 Drops begrenzt.
- **Bewusst offen:**
  - **Teiglinge mit Puffer:** Sie werden aus der Gesamtzahl aufgerundet, die Pizzen je Sorte einzeln. Die Summe der Sorten kann daher leicht über den Teiglingen liegen. Die Teiglinge-Zeile ist die Bestellmenge für den Teig.
  - **Historie ungewichtet:** Sie wird nicht nach der Größe der Drops gewichtet.
  - **Abgehakt nur pro Gerät:** Abgehakte Positionen werden nicht zwischen Geräten geteilt.
