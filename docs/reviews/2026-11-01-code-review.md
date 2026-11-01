# Code-Review Zwischenstand (2026-11-01)

**Auftrag:** `code_review_prompt.md`, Codequalität und Wartbarkeit (toter Code, Duplikate, ungenutzte Komponenten, Komplexität, Altlasten, redundante Abfragen, verwaiste Dateien, technische Schulden).
**Stand:** `09225f6` (Phasen 0–6 live, 7a Drop-Alarm lokal).
**Vorgehen:**

- Drei Prüfer haben parallel und nur lesend gearbeitet: toter Code, Duplikate und Komplexität, Datenbank- und API-Aufrufe.
- Danach wurden die Kernaussagen stichprobenartig gegen den Code geprüft.
- Nichts wurde geändert.

**Korrigiert gegenüber den Prüfberichten:**

- `src/lib/utils.ts` ist nicht ungenutzt: 12 App-Dateien importieren `@/lib/utils`.
- Der Stripe-Abruf bei der Rückkehr von Stripe läuft nur, solange die Bestellung noch offen ist. Ist sie bezahlt, bleibt nur das doppelte Lesen der Bestellung.

**Gesamturteil:** Die Codebasis ist schlank und gut getestet. Echter toter Code beschränkt sich auf den Entwurf aus Phase 0 und ein paar ungenutzte UI-Bausteine. Die größten Hebel sind:

- doppelte Infrastruktur, vor allem die Drop-Sperre an fünf Stellen,
- die Last durch das Polling in der Küche und auf der Bestellseite.

---

## Priorität 1 – Klar lohnend, geringes Risiko

### 1.1 Entwurf aus Phase 0 löschen (toter Code, öffentliche Route)

- **Was:**
  - `src/app/entwurf/kueche/page.tsx`
  - `src/app/entwurf/kueche/kitchen-preview.tsx`
  - `src/lib/mock/preview.ts` (zusammen ca. 12 KB)
- **Warum unnötig:** Das war der Design-Entwurf vor dem echten Küchen-Board. Das echte Board liegt in `src/app/kitchen/[dropId]/`. Keine Seite der App verlinkt auf `/entwurf`. `mock/preview.ts` sagt selbst „ab Phase 3 durch echte Daten ersetzt“.
- **Wirkung:** Eine öffentlich erreichbare Seite mit Beispieldaten fällt weg, dazu 3 Dateien und die doppelten Uhr-Formatierer.
- **Risiken:**
  - `e2e/smoke.spec.ts:15–21` ruft `/entwurf/kueche` auf. Dieser Test muss mit weg.
  - `README.md:29` nennt die Adresse.
  - `SlotBand` bleibt, weil es woanders genutzt wird.
- **Plan:** Dateien löschen, den Smoke-Test „Kitchen-Entwurf“ entfernen, die README anpassen, dann die E2E-Tests laufen lassen.

### 1.2 Drop-Sperre an einer Stelle bündeln (Duplikat, Sicherheitsregel)

- **Was:** `SELECT id FROM "Drop" WHERE id = … FOR UPDATE` steht fünfmal im Code:
  - `src/app/admin/drops/actions.ts:42`
  - `src/lib/booking/reserve.ts:98`
  - `src/lib/kitchen/kitchen.ts:47`
  - `src/lib/payment/cancel.ts:42`
  - `src/lib/payment/settle.ts:70`
- **Warum:** Die Kernregel aus `docs/PLAN.md` („alle Drop-Änderungen sperren zuerst die Drop-Zeile“) hängt an kopiertem Code. Ein Tippfehler in einer Kopie würde die Sperre unbemerkt aushebeln.
- **Wirkung:** Eine Funktion `lockDrop(tx, dropId)` in `src/lib/db-lock.ts`, ca. 15 Zeilen weniger, eine einzige Stelle für die Regel.
- **Risiko:** Sehr gering, das SQL ist überall identisch. In `settle.ts` und `cancel.ts` gibt es zusätzlich das Muster „Bestellung lesen → Drop sperren → neu lesen“. Ein Helfer `lockDropOfOrder` müsste `null` zurückgeben, weil die Aufrufer bei „nicht gefunden“ unterschiedlich reagieren.
- **Plan:** Helfer anlegen, die 5 Stellen umstellen, Integrationstests laufen lassen (die parallelen Tests prüfen die Sperre).

### 1.3 Uneinheitliche Behandlung von „Datenbank belegt“ (Duplikat mit Verhaltensunterschied)

- **Was:**
  - Die Küche (`kitchen.ts:38`) wertet P2024, P2028 und P2034 als „gerade belegt, nochmal versuchen“.
  - Die Reservierung (`reserve.ts:79`) kennt nur P2028.
  - Die Transaktions-Optionen unterscheiden sich:
    - Reservierung und Küche: 15 s
    - Zahlung und Storno: 20 s
    - Admin-Drops: ohne `maxWait`
- **Warum:** Bei einem Verbindungs-Timeout (P2024) oder Serialisierungskonflikt (P2034) bekommt ein Kunde bei der Reservierung eine Fehlerseite statt „gerade viel los“.
- **Wirkung:** Ein gemeinsames `isBusyError(e)` in `src/lib/tx.ts`, dazu die Optionen als benannte Konstanten.
- **Risiko:** Das ändert das Verhalten der Reservierung bewusst; die Fehlermeldung wird freundlicher. Die Zeitlimits nicht vereinheitlichen, die 20 s für die Zahlung sind gewollt (Stripe-Erstattung in der Transaktion).
- **Plan:** Zuerst ein RED-Test für die Reservierung mit P2024, dann den Helfer einführen.

### 1.4 Ungenutzte Entwicklungsabhängigkeiten

- **Was:** `@testing-library/dom`, `@testing-library/react` und `jsdom` (package.json:56, 57, 66).
- **Warum:** Kein Import und kein `@vitest-environment jsdom` im ganzen Projekt. Nur ein Kommentar in `vitest.config.mts` erwähnt sie.
- **Wirkung:** Spürbar kleinere Installation, schnelleres `npm ci` in der CI.
- **Risiko:** Komponententests sind nicht geplant; bei Bedarf lassen sich die Pakete in einer Minute wieder hinzufügen.
- **Plan:** `npm uninstall`, den Kommentar in `vitest.config.mts` anpassen, Tests laufen lassen.

### 1.5 Bestellseite: weniger Stripe- und Datenbankabrufe

- **Was:** `src/app/(shop)/bestellung/[id]/page.tsx:92, 163–170` zusammen mit `src/lib/payment/reconcile.ts`.
  - Nach der Rückkehr von Stripe bleibt `?bezahlt=1` in der Adresse.
  - Solange die Zahlung noch bestätigt wird, ruft jedes automatische Neuladen (alle 3 s, bis zu 40-mal) erneut `checkout.sessions.retrieve` bei Stripe auf.
  - Danach liest jedes Neuladen (alle 15 s) die Bestellung zweimal.
- **Warum:** Der Webhook ist der eigentliche Weg der Bestätigung. 40 Stripe-Abrufe pro Kunde sind unnötig und zählen gegen das Stripe-Limit.
- **Wirkung:**
  - Bis zu 40 Stripe-Abrufe weniger pro Zahlung.
  - Die Hälfte der Bestell-Abfragen beim Status-Polling.
- **Risiko:** „Wird bestätigt“ kann ein paar Sekunden länger stehen. Die Verbuchung ist idempotent, deshalb ist es sicher, einzelne Abrufe auszulassen.
- **Plan:**
  - Den Abgleich mit Stripe nur beim ersten Laden und danach gestaffelt (z. B. nach 3, 6, 12 s) machen.
  - Die Bestellung nur einmal pro Aufruf lesen.

## Priorität 2 – Lohnend, mit etwas Aufwand

### 2.1 Polling der Küche (größte Last im Betrieb)

- **Was:** `live-board.tsx` ruft alle 3 s `loadBoardAction` auf.
  - Jeder Aufruf liest den angemeldeten Nutzer plus das komplette Board: alle Slots mit Tickets, Pizzen und Bestellungen sowie alle Bestellungen mit Positionen.
  - Das sind bis zu ca. 9 Abfragen pro Aufruf, also bis zu ca. 180 pro Minute und Gerät.
  - Ob Prisma die Beziehungen per Join oder per Einzelabfragen lädt, ist nicht geprüft.
- **Warum:** Meist hat sich zwischen zwei Abrufen nichts geändert. Bei mehreren Tablets hält das außerdem die Neon-Datenbank dauerhaft wach (Kosten).
- **Wirkung:** Mit einer leichten Prüfung „hat sich etwas geändert?“ (1–2 Abfragen) fällt die Last während eines Drops um ein Vielfaches.
- **Risiko:**
  - Manche Änderungen stehen nicht in der Datenbank. Reservierungen laufen ab, ohne dass etwas geschrieben wird; Verzug und Status hängen an der Uhrzeit.
  - Eine solche Versionsprüfung braucht deshalb einen Sicherheits-Volllauf etwa alle 30 s.
  - Die Aktionen selbst bleiben sicher, weil sie unter der Sperre neu lesen.
- **Plan:**
  - Einfacher Schritt zuerst: Polling 3 s, solange eine Pizza im Ofen ist, sonst 8 s.
  - Danach eine Versionsprüfung, wenn der Betrieb es zeigt.

### 2.2 Drop-Alarm: Abfragen pro Lauf

- **Was:** `src/lib/marketing/drop-alert.ts` lädt pro Lauf und Drop alle bestätigten Abonnenten und alle Mail-Protokolleinträge. Vor jeder Mail prüft es den Status einzeln, das sind bis zu 40 zusätzliche Abfragen pro Lauf.
- **Warum:** Bei wenigen Hundert Abonnenten ist das egal. Bei Tausenden liest jeder Lauf alle Zeilen erneut.
- **Wirkung:**
  - Die noch offenen Abonnenten in einer Abfrage mit `take` laden (`NOT EXISTS` gegen das Mail-Protokoll).
  - Den Status gesammelt pro Stapel prüfen statt einzeln.
- **Risiko:**
  - Der Schutz bei Abmeldung während des Laufs muss erhalten bleiben (Stapel klein halten).
  - Den Doppelversand verhindert weiterhin `sendMail`.
- **Plan:** Umsetzen, wenn die Liste wächst. Die Integrationstests decken das Verhalten bereits ab.

### 2.3 Fehlende Indizes

- **Mail-Protokoll:**
  - `confirmMailsLastHour` filtert nach `kind` und `createdAt`; dafür fehlt ein Index, also wird bei jeder Anmeldung die ganze Tabelle gelesen.
  - Die Suche `dedupeKey startsWith` nutzt den Unique-Index nur mit passender Sortierung (`text_pattern_ops`).
- **Abonnenten:** Für `status` und `confirmedAt` fehlt ein Index.
- **Wirkung:** Erst bei Tausenden Zeilen spürbar, dann aber dauerhaft.
- **Risiko:** Das ist eine Migration und muss vor dem Push auf Produktion angewendet werden.
- **Plan:** Zusammen mit der nächsten nötigen Migration erledigen, z. B. Warteliste oder Gutscheine.

### 2.4 Startseite und Drop-Liste laden zu viel

- **Was:**
  - `src/lib/booking/availability.ts` und `shop.ts` laden für jeden angezeigten Drop alle Slots und die vollständigen Pizza-Datensätze, gebraucht werden aber nur Zahlen und Status.
  - Ebenso lädt die Drop-Liste im Admin (`admin/drops/page.tsx`) alle Slots von bis zu 100 Drops nur zum Zählen.
- **Wirkung:** Deutlich weniger übertragene Zeilen pro Aufruf der Startseite.
- **Risiko:** Die Reservierung braucht unter der Sperre die genaue Slot-Liste. Diese Variante muss bleiben; dazu kommt eine leichte Variante für Listen.
- **Plan:** `groupBy` bzw. `_count` für die Listen, `select` statt `include: { pizza: true }`.

### 2.5 Wiederkehrende Kleinteile zusammenführen

- **Formatierung:** `dateTime()` steht doppelt in `admin/bestellungen/[id]/page.tsx:26` und `admin/drops/[id]/page.tsx:28`. Vorschlag: `formatDateTime()` in `src/lib/format.ts`. Der Uhr-Formatierer der Küche ist nach dem Löschen des Entwurfs (1.1) nur noch einmal vorhanden.
- **App-Adresse:** `appUrl()` liegt in `src/lib/payment/order-mails.ts`, wird aber auch vom Marketing genutzt. Vorschlag: nach `src/lib/app-url.ts` verschieben.
- **ID-Prüfung:** Für IDs gibt es zwei Varianten, `z.string().min(1).max(40)` und `z.string().min(1)` ohne Obergrenze (Admin-Aktionen). Vorschlag: ein gemeinsames `idSchema` in `src/lib/validation/ids.ts`. Vorher prüfen, dass alle Test-IDs kürzer als 40 Zeichen sind.
- **Admin-Knöpfe:** Drei Admin-Komponenten wiederholen dasselbe Muster aus `useTransition`, Toast und Fehlermeldung (`cancel-order.tsx`, `resend-mail.tsx`, `slot-grid.tsx`). Vorschlag: ein Hook `useServerAction()`, ca. 40 Zeilen weniger.
- **E2E-Helfer:** Die E2E-Funktion `reserve()` steht doppelt in `e2e/kitchen.spec.ts` und `e2e/payment.spec.ts`. Vorschlag: nach `e2e/support/flows.ts` verschieben.

## Priorität 3 – Optional oder später

- **Ungenutzte UI-Bausteine:** `src/components/ui/dropdown-menu.tsx`, `select.tsx`, `table.tsx` und `separator.tsx` werden nirgends importiert (ca. 17 KB Quelltext). Sie kosten im Bundle nichts, weil ungenutzter Code nicht mitgebaut wird. Löschen ist sicher; sie lassen sich per `npx shadcn add` neu erzeugen. Empfehlung: löschen.
- **Nur noch im Test genutzt:** `findConsecutiveStarts` (`src/lib/domain/slots.ts:41`) wird nur noch vom eigenen Test verwendet. Die Reservierung sucht freie Folgen inzwischen anders. Empfehlung: Funktion und Test löschen. Vorher prüfen, ob `pickupOptions` dieselbe Logik schon enthält.
- **Uneinheitliche `cn`-Importe:** Die UI-Komponenten importieren `cn` direkt aus dem Paket `cn` (offizielles shadcn-Paket), die App-Dateien über `@/lib/utils`. Das ist harmlos, aber uneinheitlich. Empfehlung: alles auf `@/lib/utils` umstellen (shadcn-Konvention, passt zu `components.json`).
- **Status PREP im Schema:** Den Ticket-Status `PREP` gibt es nur im Schema; der Code bildet ihn auf „wartet“ ab. Entfernen ginge per Migration, vorher Produktionsdaten prüfen. Empfehlung: aufheben, bis Phase 10 ohnehin migriert wird.
- **Zwei Status-Typen:** Der Typ `OrderStatus` wird von Hand gepflegt (`domain/drops.ts`), parallel zum Prisma-Enum. Das ist bewusst so, die Fachschicht bleibt frei von Prisma. Sicherer wäre ein Typtest, der beide abgleicht.
- **Veraltete Phasenhinweise in Kommentaren:**
  - `(shop)/bestellung/[id]/page.tsx:189, 255` „(Phase 5)“
  - `(shop)/bestellung/[id]/actions.ts:47` „Ab Gutscheinen (Phase 7)“, das kommt erst noch
  - Empfehlung: beim nächsten Anfassen der Dateien bereinigen.
- **Erstattung innerhalb der Transaktion:** In `settle.ts:99, 157` läuft die Stripe-Erstattung innerhalb der Transaktion, die Sperre bleibt während des Netzaufrufs gehalten. Das tritt nur bei doppelten oder verspäteten Zahlungen auf, also selten, und ist bereits im TDD-Nachweis zu Phase 4 als bewusst offen notiert.
- **Einstellungen mehrfach gelesen:** `getSettings()` wird nicht pro Anfrage zwischengespeichert, kostet aber nur eine kleine Abfrage. Empfehlung: in `cache()` von React einpacken.

## Bewusst behalten

- **`AutoRefresh`:** Wird von der Bestellseite noch gebraucht und ist nicht durch das Polling der Küche ersetzt.
- **`scripts/create-admin-production.ps1`:** Dokumentiertes Werkzeug für den Betrieb, nicht über `package.json` erreichbar, aber gewollt.
- **Exportierte Typen, die nur in der eigenen Datei genutzt werden** (ca. 30): normal und harmlos. Das `export` zu entfernen wäre nur Aufwand ohne Nutzen.
- **Test-Helfer** (`test/db-fixtures.ts`, `test/server-only-stub.ts`): werden gebraucht.

## Umgesetzt (2026-11-01)

- **Schritt 1:** 1.1, 1.4 und aus Priorität 3 die UI-Bausteine, `findConsecutiveStarts` und die `cn`-Importe (`baa73ce`).
- **Schritt 2:** 1.2 und 1.3, also `src/lib/tx.ts` mit `lockDrop()` und `isBusyError()` (`e085e7b` RED, `5f00698` GREEN).
- **Schritt 3:**
  - 1.5 Bestellseite (`db12af2`)
  - 2.1 als einfacher Schritt: Polling 3 s bzw. 6 s (`e1a3061`)
- **Gegenprüfung durch `code-reviewer`:** keine kritischen, schweren oder mittleren Befunde.
- **Offen nach Plan:**
  - 2.3 Indizes, mit der Migration für die Warteliste
  - 2.2, 2.4 und 2.5 nach Bedarf

## Vorgeschlagene Reihenfolge

1. **Ein Commit „Aufräumen“:**
   - 1.1 Entwurf löschen
   - 1.4 Abhängigkeiten entfernen
   - Priorität 3: UI-Bausteine, `findConsecutiveStarts` und `cn`-Importe
   - Kein Verhalten ändert sich; nur Tests laufen lassen.
2. **1.2 und 1.3 Transaktions-Helfer**, mit RED-Test für P2024 bei der Reservierung.
3. **1.5 Bestellseite**, dann 2.1 als einfacher Schritt (Polling-Intervall der Küche).
4. **2.3 Indizes** zusammen mit der Migration für die Warteliste.
5. **2.2 und 2.4**, sobald Daten oder Nutzung wachsen.
