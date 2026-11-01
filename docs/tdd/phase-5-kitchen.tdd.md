# TDD-Nachweis Phase 5: Kitchen-Mode (Teil 1)

**Quelle:** `docs/PLAN.md` (1.4 Kitchen-Mode, 3.3 Kitchen-Timeline, Phase 5 in Abschnitt 5).
**ECC:**

- Skills: `tdd-workflow`, `react-performance`, `e2e-testing`, `browser-qa`.
- Reviews durch die Agenten `react-reviewer`, `typescript-reviewer` und `silent-failure-hunter`.

**Umfang Teil 1:**

- Warteschlange in Slot-Reihenfolge mit einem Ofen
- Ofen-Timer, Plan-Ist-Vergleich, Ø-Ofenzeit mit Hinweis zur Slotlänge
- Puffer-Slot, Ausgabe „Abgeholt“, Live-Status für Kunden
- Mehrere Geräte per Polling, Wake Lock

**Teil 2 (offen):**

- Ausgabe mit Suche und QR-Scan
- PWA-Manifest

## User Journeys

- Als Küche sehe ich auf dem Tablet, welche Pizza im Ofen ist (mit Timer), welche als Nächstes kommt und welche Bestellungen abholbereit sind – auf allen Geräten gleich.
- Als Küche schiebe ich Pizzen in Slot-Reihenfolge in den Ofen, melde sie fertig und gebe abholbereite Bestellungen aus.
- Als Küche hole ich Verzug auf, indem ich den nächsten freien Slot als Puffer sperre.
- Als Kunde sehe ich auf meiner Bestellseite „im Ofen“ und „abholbereit“.

## RED → GREEN

| Schritt                                     | RED                                                                                        | GREEN                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------- |
| Fachlogik (`src/lib/domain/kitchen.ts`)     | `7b5e891`: vitest bricht ab, weil `./kitchen` fehlt                                        | `027ccdd`: 24 Unit-Tests grün          |
| Küchen-Aktionen gegen die Datenbank         | `412f3eb`: `test:integration` bricht ab, weil `./kitchen` fehlt                            | `112fdb1`: 6 Integrationstests grün    |
| Review: Storno während der Küche (unklar)   | `f1c8a31`: neuer Test schlägt fehl – „Das gibt es nicht mehr.“ bzw. „noch nicht fertig“    | `17a6147`: klare Meldung „storniert“   |
| Review: Netzabbruch und abgelaufene Sitzung | neuer E2E-Test schlägt fehl – das Tablet landet offline auf der Chrome-Fehlerseite (Trace) | `8883284`: Warnung, Board läuft weiter |

## Was die Tests garantieren

| #   | Garantie                                                                                                                       | Test                                          | Art         |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- | ----------- |
| 1   | Queue in Slot-Reihenfolge: Ofen, Als Nächstes, Danach, Fertig                                                                  | `src/lib/domain/kitchen.test.ts`              | Unit        |
| 2   | In den Ofen nur die nächste Pizza und nur bei leerem Ofen; „Fertig“ nur für die Pizza im Ofen                                  | › canStartTicket, canFinishTicket             | Unit        |
| 3   | Verzug aus dem Ende der Pizza im Ofen (oder „käme jetzt hinein“) minus Slotende; Lücken bauen Verzug ab; nie negativ           | › delaySeconds                                | Unit        |
| 4   | Ø-Ofenzeit; ab drei Messungen ein Vorschlag zur Slotlänge auf 30 s gerundet                                                    | › averageBakeSeconds, slotLengthHint          | Unit        |
| 5   | Bestellstatus: bezahlt → in Arbeit → abholbereit, wenn alle Pizzen fertig; Ausgabe nur abholbereit                             | › orderStatusFromTickets, canPickUp           | Unit        |
| 6   | „Danach“ fasst freie Slots zu Lücken zusammen; Puffer sperrt den nächsten freien, noch nicht begonnenen Slot                   | › laterTimeline, nextBlockableSlot            | Unit        |
| 7   | Ablauf bis zur Abholung gegen die Datenbank, inkl. Status der Bestellung                                                       | `src/lib/kitchen/kitchen.integration.test.ts` | Integration |
| 8   | Fünf gleichzeitige Ofenstarts derselben Pizza: genau einer gelingt (Drop-Sperre)                                               | › Kitchen-Mode                                | Integration |
| 9   | Stornierte Bestellung: Ofen, Fertig und Ausgabe melden „storniert“; unbekannte Bestellung „gibt es nicht“                      | › Kitchen-Mode                                | Integration |
| 10  | Puffer-Slot gesperrt; ohne freien Slot eine Meldung; Board-Daten (Ofen, nächste Pizza, Abholbereit)                            | › Kitchen-Mode                                | Integration |
| 11  | Zwei Küchengeräte bleiben synchron; gesperrter Ofenstart; Kunde sieht „im Ofen“ und „Abholbereit!“; Ausgabe auf beiden Geräten | `e2e/kitchen.spec.ts` (Desktop)               | E2E         |
| 12  | Offline: Warnung „Verbindung unterbrochen“, danach läuft das Board weiter; abgelaufene Sitzung: Meldung mit Anmelde-Knopf      | `e2e/kitchen.spec.ts` (Desktop)               | E2E         |

## Befehle und Ergebnisse (zuletzt ausgeführt)

- `npm test`: 169 Tests bestanden
- `npm run test:integration` (Neon-Zweig `dev`): 30 Tests bestanden
- `npx playwright test`: 30 bestanden, 2 übersprungen (Küche nicht mobil); Küchen-Spec mit `--repeat-each=3` stabil
- `npm run typecheck`, `npm run lint`, `npx prettier --check src e2e playwright.config.ts`: sauber

## browser-qa (lokal, Testdaten, Seed-Konto der Küche)

- axe-core (WCAG 2.0/2.1/2.2 A und AA) auf `/kitchen` und dem Board: 0 Verstöße. axe deckt nur einen Teil von WCAG ab; die Tastaturreihenfolge wurde zusätzlich geprüft und ist logisch.
- Keine Konsolenfehler, keine 4xx/5xx.
- Screenshots bei 375, 768 und 1440 px: Layout ohne Überlauf, gesperrter Knopf sichtbar gedimmt.
- **Visueller Vergleich:** INCONCLUSIVE, es gibt noch keine Baseline-Screenshots.
- **Fokusring:** wurde nur nach Code (shadcn `focus-visible`) beurteilt, nicht gemessen.

## Reviews und Umgang damit

- **react-performance:**
  - Der Sekundentakt läuft nur noch in Uhr und Ofen-Timer, statt das ganze Board jede Sekunde neu zu rendern.
  - Auf der Board-Seite laufen Anmeldung, `connection()` und `params` parallel.
- **Behoben nach den Reviews:**
  - **Netz und Polling:**
    - Polling per Server-Action statt `router.refresh()`. Offline lud Next.js hart neu, und das Tablet blieb auf der Fehlerseite.
    - Warnung bei Daten älter als 10 s.
    - Die Kundenseite lädt offline nicht neu.
  - **Abgelaufene Sitzung:** Sie wird als Ergebnis gemeldet, mit Anmelde-Knopf. Der Proxy leitet Server-Action-Anfragen nicht mehr um; die Aktionen prüfen selbst über die Data Access Layer.
  - **Datenbank-Aktionen:**
    - Tickets und Bestellungen werden unter der Sperre neu gelesen.
    - Eine Bestellung ohne passenden Status bricht die Aktion ab, statt still stehen zu bleiben.
    - Prisma-Fehler werden unterschieden: kurz belegt (nochmal tippen) oder technischer Fehler. Protokolliert wird mit ID.
  - **Typen:** ein vollständiges Status-Mapping statt Casts, kein Non-Null-Assert.
  - **Uhr:** Sie springt beim Polling nicht mehr; es zählt der größte gemessene Abstand.
  - **Barrierefreiheit:**
    - h1 und eindeutige Namen für „Abgeholt“.
    - Keine Dauerdurchsage des Verzugs, Hinweis „überfällig“.
    - `motion-reduce` und eine größere Tippfläche.
  - **Wake Lock:** Die vorige Sperre wird freigegeben.
- **Bewusst offen:**
  - **Storno einer Pizza im Ofen:** Sie verschwindet beim nächsten Polling ohne Hinweis in der Küche. Eine Liste „gerade storniert“ bzw. eine Warnung im Admin-Storno kommt später.
  - **Puffer:** Tippen zwei Geräte gleichzeitig darauf, werden zwei Slots gesperrt (jeweils gewollt nacheinander). Eine Bestätigung kommt bei Bedarf.
  - **Protokoll:** Ofen, Fertig und Ausgabe werden nicht ins Audit-Log geschrieben; die Zeitstempel stehen am Ticket bzw. an der Bestellung.
  - **Wake Lock:** Gibt der Browser die Sperre selbst frei, gibt es keinen Hinweis.
  - **Ein Ofen:** Er wird nur über die Drop-Sperre erzwungen, nicht per Datenbank-Constraint.
  - **Phase 5, Teil 2:** Suche und QR-Scan bei der Ausgabe, PWA-Manifest.
