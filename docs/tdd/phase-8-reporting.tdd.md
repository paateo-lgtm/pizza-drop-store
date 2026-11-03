# TDD-Nachweis Phase 8: Reporting (MVP)

**Quelle:** `docs/PLAN.md` (1.3 Reporting, Phase 8 in Abschnitt 5).
**ECC:**

- Skills: `tdd-workflow`, `dataviz`
- Review durch die Agenten `code-reviewer` und `database-reviewer` (Modell sonnet, nur lesend)
- Prüfung im Browser: Screenshots per Playwright, Desktop und Mobil

## Umfang

MVP nach Absprache:

- KPI-Dashboard
- Bericht pro Drop
- CSV-Export
- Filter nach Zeitraum und Drop

Folgt in 8b:

- Pizza-Bewertung
- Kunden (neu/Stamm, Wiederkauf)
- Zeitanalysen
- Küche
- Marketing, inklusive Anteil der Bestellungen über den Alarm. Das braucht `Order.source` und eine Migration.

## User Journeys

- **Dashboard:** Als Admin öffne ich `/admin/reporting`. Ich sehe Umsatz brutto/netto, Bestellungen, Pizzen, Ø Bestellwert und die Storno-, Erstattungs- und No-Show-Quote, dazu die Pizzen mit Stück, Anteil und Umsatz. Ich filtere nach Zeitraum und Drop.
- **Drop-Bericht:** Unter `/admin/reporting/drops/[id]` sehe ich:
  - Auslastung
  - Zeit bis ausverkauft
  - Verkaufsverlauf ab Verkaufsstart
  - Top-Pizzen
- **CSV-Export:** Ich lade die bezahlten Bestellpositionen im aktuellen Filter als CSV für Excel.

## Entscheidungen

- **Gezählt** werden bezahlte Bestellungen (`paidAt` gesetzt).
  - Späte Zahlungen, die sofort erstattet werden, haben kein `paidAt` und zählen nicht.
- **Zeitraum** = Backtag des Drops (`bakeStartsAt`) als Berliner Kalendertag, `bis` inklusive. So passen Dashboard und Drop-Bericht zusammen.
- **Umsatz:**
  - brutto = Σ `totalCents` minus Erstattungen
  - netto = brutto minus USt; die USt wird bei Erstattungen anteilig gekürzt
- **Erstattungen mindern den Umsatz nur bei stornierten Bestellungen** (`CANCELLED`, `REFUNDED`).
  - Bei aktiven Bestellungen gibt es heute nur die Erstattung einer Doppelzahlung (`settle.ts`): Geld kommt zweimal und geht einmal zurück, der Umsatz bleibt.
  - Kommen später Teilerstattungen auf aktive Bestellungen, braucht `Refund` eine Art.
- **Stornierte** zählen in Storno- und Erstattungsquote, nicht bei Pizzen, Ø Bestellwert, Top-Pizzen und Verkaufsverlauf.
- **No-Show-Quote** = `NO_SHOW` / (`PICKED_UP` + `NO_SHOW`).
- **Kapazität** für „ausverkauft“ = Slots ohne Sperre, höchstens `maxPizzasTotal`, wie auf der Drop-Seite.
- **Aggregation in TypeScript** statt SQL. Bei Shop-Volumen (wenige hundert Bestellungen pro Drop) reicht das, die Logik ist rein und unit-testbar. Bei Wachstum auf `groupBy`/SQL umstellen.
- **CSV:**
  - eine Zeile pro Position, ohne Kontaktdaten
  - Bestellbeträge nur in der ersten Zeile, damit Spaltensummen stimmen
  - Beträge ohne Tausenderpunkt
  - Semikolon, CRLF und UTF-8-BOM für Excel (DE)
  - Texte mit `= + - @` am Anfang bekommen ein Hochkomma (Formel-Injektion)
- **Charts** als Inline-SVG ohne neue Abhängigkeit, also ohne Änderung am Lockfile.
  - Eine Reihe in Markenfarbe, eine Kategorienpalette ist nicht nötig.
  - Die Werte stehen zusätzlich als Text bzw. als Tabelle für Screenreader.
- **Rechte:** Seiten und Export nur mit `reports:view`.

## RED → GREEN

| Schritt                                                        | RED                                                       | GREEN                                          |
| -------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------- |
| Kennzahlen, Filter, CSV, Ladefunktionen                        | `48c0cb1`: 18 Unit- und 5 Integrationstests schlagen fehl | `c1e493c`: 253 Unit, 5 Integration (Reporting) |
| Zeit bis ausverkauft beachtet `maxPizzasTotal`                 | `3eb496c`: 1 Integrationstest schlägt fehl                | `410e552`                                      |
| Filter akzeptiert UUIDs als Drop-ID (gefunden per E2E)         | `f1d0202`: 1 Unit-Test schlägt fehl                       | `4e2fad9`                                      |
| Dashboard, Drop-Bericht, Export-Route                          | E2E `e2e/reporting.spec.ts`                               | `8717f2e`, `08f3cc7` (Layout)                  |
| Review: Doppelzahlung, CSV-Summen, Drop-Auswahl, Chart-Tabelle | `2a4cc0b`: 4 Unit-Tests und 1 E2E schlagen fehl           | `8e07167`                                      |

## Was die Tests garantieren

| #   | Garantie                                                                                                      | Test                                                 | Art         |
| --- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ----------- |
| 1   | Umsatz brutto/netto, Pizzen, Ø Bestellwert; Erstattungen nur bei Stornos, USt anteilig; Doppelzahlung neutral | `src/lib/domain/reporting.test.ts` › summarizeOrders | Unit        |
| 2   | Storno-, Erstattungs- und No-Show-Quote; Nullen statt NaN                                                     | › summarizeOrders                                    | Unit        |
| 3   | Slots je Zustand, Auslastung ohne gesperrte Slots                                                             | › slotUsage                                          | Unit        |
| 4   | Verkaufsverlauf kumuliert ab Verkaufsstart; Zeit bis ausverkauft an der Zahlung, die die Kapazität erreicht   | › salesCurve                                         | Unit        |
| 5   | Top-Pizzen nach Name zusammengefasst, sortiert, mit Anteil und Umsatz                                         | › topPizzas                                          | Unit        |
| 6   | Filter: Berliner Kalendertage inkl. Sommerzeit, `bis` inklusive, ungültige Werte fallen weg, cuid und UUID    | › parseReportFilter                                  | Unit        |
| 7   | CSV mit BOM, Semikolon, CRLF, Quoting und Formel-Schutz                                                       | › toCsv                                              | Unit        |
| 8   | CSV-Tabelle: Bestellbeträge nur in der ersten Zeile, Zeilensumme, ohne Tausenderpunkt                         | › exportTable                                        | Unit        |
| 9   | Nur bezahlte Bestellungen des gefilterten Drops; Zeitraum nach Backtag                                        | `src/lib/reporting/queries.integration.test.ts`      | Integration |
| 10  | Drop-Bericht ohne stornierte Bestellungen; Kapazität mit `maxPizzasTotal`; unbekannter Drop = null            | › loadDropReport                                     | Integration |
| 11  | Export: eine Zeile pro Position, Kopfzeile, keine Kontaktdaten                                                | › exportRows                                         | Integration |
| 12  | Export ohne Anmeldung leitet zum Login                                                                        | `e2e/reporting.spec.ts`                              | E2E         |
| 13  | Admin sieht Kennzahlen und Pizzen, lädt CSV, Drop-Auswahl bleibt erhalten, Drop-Bericht mit Chart und Tabelle | `e2e/reporting.spec.ts`                              | E2E         |

## Review-Befunde

| Befund                                                                | Schwere | Ergebnis                                                          |
| --------------------------------------------------------------------- | ------- | ----------------------------------------------------------------- |
| Erstattung einer Doppelzahlung setzte den Umsatz der Bestellung auf 0 | HIGH    | behoben (`8e07167`)                                               |
| Gewählter Drop fehlte in der Auswahl, wenn außerhalb des Zeitraums    | MEDIUM  | behoben                                                           |
| CSV: Bestellsummen in jeder Positionszeile                            | MEDIUM  | behoben                                                           |
| Chart für Screenreader nicht erschließbar                             | MEDIUM  | behoben (sr-only-Tabelle)                                         |
| Zeitachse ohne Datum bei mehrtägigem Verkauf                          | MEDIUM  | behoben                                                           |
| Export ohne Recht: Umleitung statt 403                                | LOW     | belassen, wie im übrigen Admin                                    |
| Laden und Export ohne Obergrenze                                      | LOW     | belassen, bei Shop-Volumen unkritisch                             |
| `OrderItem.orderId` und `Refund.orderId` ohne Index                   | LOW–MED | behoben, Migration `20261103072549_order_item_refund_order_index` |

## Ergebnis

- Unit 257, Integration 78, E2E 69 bestanden (5 übersprungen)
- Typecheck, ESLint und Prettier sauber
