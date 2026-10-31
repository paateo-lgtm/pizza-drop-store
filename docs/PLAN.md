# Implementierungsplan: Pizza Drop Store

**Status:** Entwurf v3 – wartet auf Freigabe
**Stand:** 2026-10-31
**Komplexität:** Hoch (ca. 9 Wochen für eine Person bis zur produktiven Version 1)

### Entscheidungen

| Thema                 | Entscheidung                                                                                                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sortiment             | Nur Pizza; keine Extras, keine Zutatenänderungen, keine Getränke oder Dips                                                                                                             |
| Slot-Modell           | **1 Slot = 1 Pizza.** Die Slotlänge ist die Zeit pro Pizza (z. B. 6 min). Eine Bestellung mit n Pizzen belegt n **aufeinanderfolgende** Slots; abgeholt wird am Ende des letzten Slots |
| Umfang eines Drops    | Backzeitraum (z. B. 15–20 Uhr) und Slotlänge ergeben die Zahl der Slots; optional eine kleinere Obergrenze an Pizzen                                                                   |
| Ofen                  | Kapazität 1                                                                                                                                                                            |
| Zeit pro Pizza ändern | Standardwert global einstellbar. Ab Verkaufsstart ist das Raster eines Drops **fix**; bei Verzug werden freie Slots als **Puffer gesperrt**. Eine neue Zeit gilt für den nächsten Drop |
| Zusatzfunktionen      | Drop-Alarm (Newsletter), Warteliste, Gutscheincodes, Vorbereitungsliste, Feedback nach Abholung                                                                                        |
| Hosting               | Vercel (Pro-Plan, Region Frankfurt)                                                                                                                                                    |
| Design                | Modern, klassisch-minimalistisch, toskanische Farbwelt (Olivgrün, gedämpftes Terrakotta)                                                                                               |
| Logo, Domain          | Kommen später; bis dahin Wortmarke als Platzhalter und Vercel-Domain                                                                                                                   |

**Angenommene Standards** (gelten, solange du nichts anderes sagst): Zahlung per Karte, Apple Pay und Google Pay; nur Gastbestellung; ein fester Abholort; Stornierung nur durch den Admin; Sprache Deutsch.

---

## 1. Anforderungen

### 1.1 Kundenbereich (öffentlich)

- **Landingpage:** nächster Drop mit Countdown bis Verkaufsstart bzw. Restverfügbarkeit, kommende Drops, „So funktioniert's“, FAQ, Abholort und Anmeldung zum Drop-Alarm.
- **Drop-Seite:** Pizzen mit Bild, Beschreibung, Preis und Allergenen. Der Kunde wählt Sorten und Mengen, insgesamt n Pizzen.
- **Abholzeit wählen:** Angezeigt werden nur Abholzeiten, für die n Slots am Stück frei sind. Der Kunde sieht direkt die **Abholzeit**, also das Ende des letzten Slots. Beispiel für 2 Pizzen: „Abholung 15:12 (gebacken 15:00–15:12)“.
- **Ausverkauft:** Hinweis „Ausverkauft“ und Eintrag in die Warteliste.
- **Checkout:** Name, E-Mail, Telefon, optional Gutscheincode, Notiz, optional Zustimmung zur Feedback-Mail; danach Online-Zahlung.
- **Bestätigung:** Bestellnummer, Abholcode als QR-Code, Abholzeit, Bestätigungsmail, Live-Statusseite („in Vorbereitung“, „im Ofen“, „abholbereit“).
- **Rechtliches:** Impressum, Datenschutz, AGB, Allergenkennzeichnung.

### 1.2 Admin-Bereich (geschützt, Rollen `ADMIN` / `KITCHEN`)

- **Pizza-Konfigurator:** Pizzen anlegen, bearbeiten, aktivieren und deaktivieren, sortieren. Felder: Name, Beschreibung, Bild, Preis, Allergene, Tags und **Rezept** (Zutaten mit Menge pro Pizza; daraus entsteht auch die Zutatenanzeige auf der Kundenseite).
- **Zutaten-Stammdaten:** Name, Einheit (g, ml, Stück), optional Allergen-Zuordnung.
- **Drop-Verwaltung:**
  - Status: Entwurf → geplant → Verkauf offen → Verkauf geschlossen → läuft → abgeschlossen. Ein Drop kann zusätzlich abgesagt werden.
  - Verkaufszeitraum (Pre-Sale) und Backzeitraum von–bis
  - Slotlänge, vorbelegt mit dem Standard, z. B. 6:00 min
  - Optional eine Obergrenze an Pizzen, optional maximale Pizzen pro Bestellung (Standard 4)
  - **Live-Vorschau:** „15:00–20:00 bei 6 min = 50 Slots = max. 50 Pizzen; erste Abholung 15:06, letzte 20:00“
  - Pizzen zuordnen, optional mit Kontingent pro Sorte und abweichendem Preis
  - Drop duplizieren, Kundenansicht vorab ansehen
  - **Slot-Raster:** Alle Slots einzeln sichtbar (frei, reserviert, verkauft, gesperrt). Freie Slots lassen sich sperren und wieder freigeben, auch im laufenden Drop (Puffer, Pause)
- **Bestellungen:** Liste mit Filtern, Detailansicht, Storno mit Erstattung (die Slots werden wieder frei), Abhaken der Abholung (auch per QR-Scan), No-Show markieren.
- **Vorbereitungsliste** (siehe 1.5), **Gutscheine** (siehe 1.6), **Abonnenten des Drop-Alarms** (siehe 1.6), **Feedback** (siehe 1.6).
- **Inhalte & Einstellungen:** Texte der Landingpage, FAQ, Abholort, Banner; Standard-Slotlänge, MwSt (7 %), Shop-Daten.
- **Reporting** (siehe 1.3), **Kitchen-Mode** (siehe 1.4), **Audit-Log**.

### 1.3 Reporting

- **KPIs:** Umsatz brutto/netto, Bestellungen, verkaufte Pizzen, durchschnittlicher Bestellwert, Storno-, Erstattungs- und No-Show-Quote.
- **Pro Drop:** Auslastung (verkaufte und gesperrte Slots), Slot-Timeline als Heatmap, Zeit bis ausverkauft, Verkaufsverlauf im Pre-Sale, Top-Pizzen.
- **Pro Pizza:** Stückzahl, Umsatz, Anteil, Bewertung.
- **Kunden:** einzigartige Kunden, Neu- vs. Stammkunden, Wiederkaufrate, Top-Kunden.
- **Zeitanalysen:** wann bestellt wird (Abstand zum Verkaufsstart, Wochentag), welche Abholzeiten beliebt sind.
- **Küche:** gemessene Ø-Zeit pro Pizza im Vergleich zur Slotlänge über die Drops hinweg (gibt eine Empfehlung für den nächsten Drop), Pünktlichkeit, maximaler Verzug.
- **Marketing:** Wachstum des Drop-Alarms, Anteil der Bestellungen über den Alarm, Wartelisten-Conversion, Gutschein-Einlösungen und -Rabatte.
- **Feedback:** Ø-Bewertung pro Drop und Pizza, Kommentare.
- **Filter:** Zeitraum, Drop, Pizza. **Export:** CSV.

### 1.4 Kitchen-Mode

- Vollbild-Ansicht im dunklen Küchen-Theme, mit Touch-Bedienung, als PWA installierbar. Der Bildschirm bleibt dank Wake Lock an.
- **Die Slot-Timeline ist die Queue**, denn jeder Slot entspricht genau einer Pizza:
  - **Jetzt:** großer Bereich mit Pizzasorte, Bestellnummer und Name, „Pizza 1 von 2“, Timer über die Slotlänge, Buttons „In den Ofen“ und „Fertig“
  - **Als Nächstes:** die nächste Pizza zum Belegen
  - **Danach:** die folgenden Slots; gesperrte und leere Slots erscheinen als Lücke, in der man aufholen kann
  - **Fertig/Abholbereit:** Bestellungen, deren Pizzen alle fertig sind
  - **Abgeholt**
- **Große Uhr** und **Plan-Ist-Vergleich:** „+2:30 Verzug“ oder „im Plan“, berechnet aus den tatsächlichen Ofenzeiten.
- **Puffer:** Mit einem Tipp auf „Nächsten freien Slot sperren“ holst du Verzug wieder rein.
- **Gemessene Ø-Zeit** pro Pizza, Hinweis bei Abweichung zur Slotlänge (z. B. „Du brauchst im Schnitt 5:20, nächster Drop mit 5:30?“).
- **Ausgabe:** Suche nach Bestellnummer oder Name, QR-Scan, „Abgeholt“ markieren.
- **Synchronisierung:** Mehrere Geräte bleiben über Polling alle 2–3 s synchron.

### 1.5 Vorbereitungsliste (neu)

- Pro Drop wird berechnet:
  - **Teiglinge** = Anzahl Pizzen
  - **Zutatenmengen** = Summe aus Rezept × Anzahl pro Sorte
- Drei Spalten: **verkauft** (aktueller Stand), **bei Ausverkauf** (Hochrechnung über die Kontingente bzw. Verteilung früherer Drops) und **mit Puffer** (+ x %, einstellbar).
- Druckansicht bzw. PDF für die Küche; Abhaken einzelner Positionen beim Vorbereiten.

### 1.6 Marketing & Kundenbindung (neu)

- **Drop-Alarm:**
  - Anmeldung mit E-Mail und Double-Opt-in (DSGVO-Pflicht), Abmeldelink in jeder Mail
  - Sobald ein Drop in den Verkauf geht (bzw. zum Verkaufsstart, per Cron), geht automatisch eine Mail an alle bestätigten Abonnenten
  - Optional (später): Vorab-Zugang für Abonnenten, z. B. 30 min vor dem öffentlichen Verkauf
- **Warteliste:**
  - Bei ausverkauftem Drop tragen sich Kunden mit E-Mail und gewünschter Anzahl ein
  - Werden durch Storno oder abgelaufene Reservierungen n Slots am Stück frei, werden die passenden Einträge in Reihenfolge benachrichtigt; wer zuerst bucht, bekommt die Slots
  - Optional: exklusiver Link, der die Slots 10 min für den ersten Eintrag reserviert
- **Gutscheincodes:**
  - Admin legt Codes an: Prozent oder fester Betrag, gültig von–bis, maximale Einlösungen gesamt und pro Kunde, optional nur für bestimmte Drops
  - Einlösung im Checkout; der Rabatt wird an Stripe übergeben und im Reporting ausgewertet
- **Feedback nach Abholung:**
  - Einige Stunden nach der Abholung geht eine Mail mit einem persönlichen Link: 1–5 Sterne pro Bestellung (optional pro Pizza) und ein Kommentar
  - **Nur mit Einwilligung** per Checkbox im Checkout, weil Feedback-Anfragen nach BGH-Rechtsprechung als Werbung gelten
  - Admin: Liste der Bewertungen, Auswertung im Reporting

---

## 2. Tech-Stack

| Bereich       | Wahl                                                                      | Begründung                                                                           |
| ------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Framework     | **Next.js 15 (App Router) + TypeScript strict**                           | Kundenseite, Admin-Bereich und API in einem Projekt; passt optimal zu Vercel         |
| Hosting       | **Vercel Pro**, Function-Region **fra1**                                  | Kommerzielle Nutzung ist nur ab Pro erlaubt (ca. 20 $/Monat); Cron minütlich möglich |
| Datenbank     | **Neon Postgres** (Vercel Marketplace, Frankfurt)                         | Transaktionen, Branching für Previews                                                |
| ORM           | **Prisma** mit Neon-Adapter                                               | Migrationen, Typsicherheit                                                           |
| Zahlung       | **Stripe Checkout + Webhooks**                                            | Karte, Apple Pay, Google Pay; Rabatte über Stripe-Coupons; Erstattungen über die API |
| Auth (Admin)  | **Auth.js v5** mit Rollen                                                 |                                                                                      |
| Validierung   | **Zod**                                                                   |                                                                                      |
| Live-Daten    | **TanStack Query** mit Polling (Küche 2–3 s, Statusseite 15 s)            | robust auf Vercel; Upgrade auf Pusher/Ably später möglich                            |
| UI            | **Tailwind CSS v4 + shadcn/ui**, eigene Design-Tokens                     |                                                                                      |
| Charts        | **Recharts**                                                              |                                                                                      |
| E-Mails       | **Resend + React Email**                                                  | Transaktionsmails, Drop-Alarm (Batch-Versand), Feedback                              |
| Bilder        | **Vercel Blob** + `next/image`                                            |                                                                                      |
| Cron          | **Vercel Cron**                                                           | Drop-Alarm zum Verkaufsstart, Warteliste, Feedback-Mails, Aufräumen                  |
| Rate-Limiting | **Upstash Redis** (Vercel Marketplace)                                    | Checkout, Login, Newsletter-Anmeldung                                                |
| Datum/Zeit    | **date-fns + @date-fns/tz**, Speicherung in UTC, Anzeige Europe/Berlin    |                                                                                      |
| PDF/Druck     | Druck-CSS (v1); `@react-pdf/renderer` bei Bedarf                          | Vorbereitungsliste                                                                   |
| Tests         | **Vitest**, **Playwright**                                                |                                                                                      |
| Qualität      | ESLint, Prettier, GitHub Actions, Vercel Preview pro Pull Request, Sentry |                                                                                      |

---

## 3. Architektur

```
┌──────────────────────── Next.js auf Vercel (fra1) ─────────────────────┐
│  (shop)/                Landingpage, Drop, Checkout, Status, Feedback, │
│                         Newsletter-Bestätigung, Warteliste             │
│  admin/                 Dashboard, Pizzen, Zutaten, Drops, Slots,      │
│                         Bestellungen, Vorbereitung, Gutscheine,        │
│                         Abonnenten, Feedback, Reporting, Inhalte, Team │
│  kitchen/[dropId]       Vollbild-Kitchen-Mode (PWA)                    │
│  api/stripe/webhook     Zahlungsbestätigung (idempotent)               │
│  api/kitchen/[dropId]   Snapshot für Polling                           │
│  api/cron/*             Drop-Alarm, Warteliste, Feedback, Aufräumen    │
├────────────────────────────────────────────────────────────────────────┤
│  lib/domain/slots       Raster erzeugen, Suche nach n Slots am Stück,  │
│                         Reservierung, Sperren                          │
│  lib/domain/kitchen     Timeline, Plan-Ist-Vergleich, Verzug           │
│  lib/domain/order       Bestell-Statusmaschine                         │
│  lib/domain/prep        Vorbereitungsliste                             │
│  lib/domain/coupon      Gutschein-Regeln                               │
│  lib/reporting/         Aggregations-Queries                           │
└──────────────┬──────────────────────────────┬──────────────────────────┘
          Neon Postgres                 Stripe · Resend
```

### 3.1 Datenmodell (Kern)

| Entität                                                                             | Wichtige Felder                                                                                                                                                                          |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `User`                                                                              | email, passwordHash, name, role, active                                                                                                                                                  |
| `Pizza`                                                                             | name, slug, description, imageUrl, priceCents, allergens[], tags[], active, sortOrder                                                                                                    |
| `Ingredient`                                                                        | name, unit, allergen?                                                                                                                                                                    |
| `PizzaIngredient`                                                                   | pizzaId, ingredientId, amountPerPizza                                                                                                                                                    |
| `Drop`                                                                              | title, slug, status, saleStartsAt, saleEndsAt, bakeStartsAt, bakeEndsAt, **slotSeconds**, maxPizzasTotal?, maxPizzasPerOrder, location                                                   |
| `DropPizza`                                                                         | dropId, pizzaId, priceOverrideCents?, maxQuantity?                                                                                                                                       |
| `Slot`                                                                              | dropId, **seq**, startsAt, endsAt, **state** (FREE, BLOCKED), orderId?, reservedUntil?, orderItemId?                                                                                     |
| `Customer`                                                                          | email (eindeutig), name, phone, firstOrderAt                                                                                                                                             |
| `Order`                                                                             | number, dropId, customerId, status, subtotalCents, discountCents, totalCents, vatCents, couponId?, pickupAt, pickupCode, stripeSessionId, expiresAt, paidAt, pickedUpAt, feedbackConsent |
| `OrderItem`                                                                         | orderId, pizzaId, nameSnapshot, unitPriceCents, quantity                                                                                                                                 |
| `KitchenTicket`                                                                     | orderId, slotId, pizzaId, seq, status (QUEUED, PREP, OVEN, DONE), ovenStartedAt, doneAt                                                                                                  |
| `Coupon`                                                                            | code (eindeutig), type (PERCENT, FIXED), value, validFrom, validTo, maxRedemptions, maxPerCustomer, dropIds[], active, stripeCouponId                                                    |
| `Subscriber`                                                                        | email, status (PENDING, CONFIRMED, UNSUBSCRIBED), confirmToken, confirmedAt, source                                                                                                      |
| `WaitlistEntry`                                                                     | dropId, email, quantity, createdAt, notifiedAt, convertedOrderId?                                                                                                                        |
| `Feedback`                                                                          | orderId, rating, comment, perPizza (JSON), createdAt                                                                                                                                     |
| `Refund`, `ProcessedWebhookEvent`, `Setting`, `SiteContent`, `AuditLog`, `EmailLog` | wie gehabt; `EmailLog` dient dem Nachweis und verhindert Doppelversand                                                                                                                   |

**Bestell-Statusmaschine:**
`PENDING_PAYMENT` → `PAID` → `IN_PROGRESS` → `READY` → `PICKED_UP`.
Nebenzweige: `EXPIRED`, `CANCELLED`, `REFUNDED`, `NO_SHOW`.

### 3.2 Slot-Modell & Buchung (Kernstück)

**Raster erzeugen:** Aus dem Backzeitraum und `slotSeconds` entstehen die Slots `seq = 1..N` mit `startsAt = bakeStartsAt + (seq−1) × slotSeconds`. Ein Rest, der für eine ganze Pizza zu kurz ist, wird abgeschnitten. Gibt es eine Obergrenze `maxPizzasTotal` < N, endet der Verkauf bei dieser Anzahl; die übrigen Slots bleiben als natürliche Puffer frei.

**Ein Slot ist frei,** wenn `state = FREE` und entweder `orderId` leer ist oder die Reservierung abgelaufen ist (`reservedUntil` < jetzt und die Order noch unbezahlt).

**Abholzeiten berechnen (n Pizzen):** Gesucht werden alle Startpositionen i, für die die Slots i..i+n−1 frei sind. Die Abholzeit ist `endsAt` des Slots i+n−1. Weitere Bedingungen: Kontingente pro Sorte und Gesamtgrenze sind noch frei.

**Reservierung (atomar):**

1. Der Server öffnet eine Transaktion und sperrt die Drop-Zeile (`SELECT … FOR UPDATE`), damit Buchungen pro Drop nacheinander verarbeitet werden.
2. Er prüft erneut, ob die Slots i..i+n−1 frei sind, und prüft die Kontingente und den Gutschein.
3. Er legt eine Order `PENDING_PAYMENT` mit `expiresAt = jetzt + 10 min` an und setzt bei den Slots `orderId` und `reservedUntil`.
4. Danach erzeugt er die Stripe-Checkout-Session (mit Rabatt, `expires_at`, Metadaten) und leitet den Kunden weiter.
5. Kommt der Webhook `completed`, wird die Order `PAID` und für jeden Slot ein `KitchenTicket` erzeugt. Die Pizzen der Bestellung werden in Slot-Reihenfolge den Slots zugeordnet.
6. Bei Ablauf oder Abbruch werden die Slots automatisch wieder frei, weil die Abfrage auf `reservedUntil` filtert. Ein Cron-Job räumt auf und stößt die Warteliste an.
7. Kommt die Zahlung erst nach Ablauf: Sind die Slots noch frei, wird die Bestellung angenommen; sonst wird sie automatisch erstattet und der Kunde per Mail informiert.

**Bekannter Effekt – Fragmentierung:** Einzelbestellungen mitten im Raster können längere freie Folgen zerteilen, sodass größere Bestellungen später keinen Platz mehr finden. Gegenmaßnahme in v1: Bei der Auswahl wird die früheste passende Zeit vorgeschlagen; das füllt das Raster von vorn. Die Wirkung wird im Reporting beobachtet (Anteil freier Einzel-Slots).

**Slotlänge ändern:**

- Im Status _Entwurf_ oder _geplant_ frei änderbar; das Raster wird neu erzeugt.
- Ab _Verkauf offen_ ist sie fix. Wirst du langsamer, sperrst du einzelne freie Slots (im Admin-Bereich oder per Tipp im Kitchen-Mode); wirst du schneller, entstehen Lücken, in denen du aufholst.
- Der Standardwert in den Einstellungen gilt für neue Drops. Das Reporting empfiehlt den Wert aus der gemessenen Ø-Zeit.

### 3.3 Kitchen-Timeline

- Die Queue entspricht den Slots in `seq`-Reihenfolge; jeder verkaufte Slot hat genau ein Ticket.
- **Plan:** Slot `startsAt`. **Ist:** `ovenStartedAt` und `doneAt`. Verzug = (tatsächliches oder hochgerechnetes Ende des aktuellen Tickets) − `endsAt` des Slots.
- Die Hochrechnung für die folgenden Tickets geht vom aktuellen Ist-Stand plus Slotlänge aus; Lücken (freie oder gesperrte Slots) bauen Verzug ab.
- Eine Bestellung wird `READY`, sobald alle ihre Tickets `DONE` sind. Die Kundenstatusseite zeigt das an.
- Der Polling-Snapshot enthält die Serverzeit, damit die Uhren aller Geräte übereinstimmen.

---

## 4. Designsprache: „Toskana, modern-minimalistisch“

**Leitidee:** Viel Weißraum auf warmem Papierton, feine Linien, eine klassische Serifenschrift für Überschriften und eine klare Sans-Serif für Text. Erdige, gedämpfte Farben; warme Fotografie (Holz, Mehl, Tageslicht).

| Token               | Wert      | Verwendung                   |
| ------------------- | --------- | ---------------------------- |
| `--paper`           | `#F7F2E8` | Seitenhintergrund            |
| `--surface`         | `#FCFAF5` | Karten, Formulare            |
| `--ink`             | `#2B2620` | Text                         |
| `--ink-muted`       | `#6F665A` | Sekundärtext                 |
| `--line`            | `#E3D9C6` | Linien                       |
| `--olive`           | `#5C6A3A` | Primärfarbe                  |
| `--olive-deep`      | `#3F4927` | Hover, Akzente               |
| `--olive-soft`      | `#DDE2C9` | Badges                       |
| `--terracotta`      | `#B4553D` | Akzent: Knappheit, Countdown |
| `--terracotta-soft` | `#F1D9CF` | Akzentflächen                |

- **Küchen-Theme:** Hintergrund `#1C1A16`, Olivgrün für „fertig“, Terrakotta für „im Ofen“ und Verzug, hoher Kontrast.
- **Typografie:** Cormorant Garamond für Überschriften und die Platzhalter-Wortmarke, DM Sans für Text und Ziffern (tabellarisch).
- **Formen:** Radien 4–6 px, Linien statt Schatten, ruhige Animationen.
- **Logo:** Platzhalter-Wortmarke, später austauschbar über eine Datei (`public/brand/`) und die Einstellungen.

---

## 5. Umsetzung in Phasen (mit ECC-Werkzeugen)

| Phase                            | Inhalt                                                                                                                                                                         | Tage | ECC-Skills / Agents                                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | ------------------------------------------------------------------------------------------------------------ |
| **0 Setup & Design**             | Repo, Next.js, Tailwind v4, shadcn/ui, Vercel + Neon, Prisma-Seed, Vitest/Playwright, CI, Design-Tokens, Moodboard und Mockups von Landingpage und Kitchen-Mode zur Abstimmung | 3    | `/ecc:project-init`, `frontend-design-direction`, `design-system`, `nextjs-turbopack`, `deployment-patterns` |
| **1 Fundament Admin**            | Prisma-Schema, Auth.js mit Rollen, Admin-Layout, Pizza-Konfigurator mit Rezept und Zutaten, Einstellungen, Audit-Log                                                           | 4    | `prisma-patterns`, `postgres-patterns`, `ecc:database-reviewer`, `/ecc:code-review`                          |
| **2 Slots & Drops**              | `lib/domain/slots` per TDD (Raster, Suche nach n Slots am Stück, Sperren, Ablauf, Sommerzeit); Drop-CRUD, Status-Workflow, Vorschau, Slot-Raster-Ansicht, Duplizieren          | 5    | `tdd-workflow`, `ecc:tdd-guide`, `typescript-patterns`, `ecc:typescript-reviewer`                            |
| **3 Kundenseite & Reservierung** | Landingpage, Drop-Seite, Auswahl der Abholzeit, atomare Reservierung mit Nebenläufigkeitstest (20 parallele Checkouts), Mobile-first                                           | 5    | `frontend-patterns`, `react-patterns`, `/ecc:react-review`, `accessibility`                                  |
| **4 Zahlung & Mails**            | Stripe Checkout, Webhook mit Idempotenz, Statusseite und QR-Code, Bestätigungs- und Storno-Mails, Storno mit Erstattung                                                        | 4    | `api-design`, `error-handling`, `ecc:security-reviewer`, `ecc:silent-failure-hunter`                         |
| **5 Kitchen-Mode**               | Tickets, Timeline, Plan-Ist-Vergleich, Puffer-Sperre, Ø-Zeit, Ausgabe mit QR-Scan, PWA mit Wake Lock, Live-Status für Kunden; E2E mit zwei Browsern                            | 6    | `react-performance`, `e2e-testing`, `ecc:e2e-runner`, `browser-qa`                                           |
| **6 Vorbereitungsliste**         | Berechnung (verkauft, bei Ausverkauf, mit Puffer), Druckansicht, Abhaken                                                                                                       | 2    | `tdd-workflow`, `/ecc:code-review`                                                                           |
| **7 Marketing**                  | Drop-Alarm mit Double-Opt-in und Versand zum Verkaufsstart, Warteliste, Gutscheine (inkl. Stripe-Coupons), Feedback mit Einwilligung                                           | 6    | `email-ops`, `api-design`, `ecc:security-reviewer`                                                           |
| **8 Reporting**                  | Dashboard, Berichte zu Drop, Pizza, Kunden, Zeit, Küche, Marketing und Feedback; CSV-Export                                                                                    | 5    | `dashboard-builder`, `dataviz`, `postgres-patterns`, `ecc:performance-optimizer`                             |
| **9 Inhalte & Recht**            | Editor für Landingpage und FAQ; Impressum, Datenschutz, AGB, Allergene; SEO, Lighthouse, Fehler- und Leerzustände                                                              | 3    | `seo`, `ecc:seo-specialist`, `accessibility`, `ecc:a11y-architect`                                           |
| **10 Härtung & Go-Live**         | Rate-Limiting, Security-Headers, Secrets, Stripe-Live-Modus, Sentry, Probe-Drop mit dem echten Team                                                                            | 3    | `/ecc:security-scan`, `security-review`, `production-audit`, `/ecc:harness-audit`, `verification-loop`       |

**Summe:** ca. 46 Arbeitstage (≈ 9 Wochen).

**Nach jeder Phase:** `/ecc:code-review` sowie `/ecc:checkpoint`, um den Stand zu sichern; bei Build-Fehlern `/ecc:build-fix`. Zwischen Sessions sichern `/ecc:save-session` und `/ecc:resume-session` den Kontext.

**Abhängigkeiten:** Die Phasen 0 bis 5 laufen nacheinander. Phase 6 kann nach Phase 2 entstehen, Phase 7 nach Phase 4, Phase 8 nach Phase 4 (wird mit jeder Phase reicher) und Phase 9 nach Phase 3.

**Möglicher MVP-Schnitt:** Die Phasen 0–5 plus 9 und 10 ergeben eine voll nutzbare erste Version nach ca. 6 Wochen. Vorbereitungsliste, Marketing und Reporting folgen danach als Version 1.1.

---

## 6. Risiken

| Risiko                                                         | Stufe    | Gegenmaßnahme                                                                              |
| -------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------ |
| Doppelbuchung von Slots                                        | **HOCH** | Lock auf die Drop-Zeile, erneute Prüfung in der Transaktion, Nebenläufigkeitstest          |
| Webhook kommt verspätet, doppelt oder gar nicht                | **HOCH** | Idempotenz, Statusseite fragt Stripe ab, Abgleich-Job                                      |
| Küche langsamer als das Raster                                 | MITTEL   | Puffer-Sperre, Verzugsanzeige, Empfehlung der Slotlänge aus Messwerten                     |
| Fragmentierung des Rasters                                     | MITTEL   | Früheste passende Zeit vorschlagen; im Reporting beobachten; später ggf. „Smart Placement“ |
| E-Mail-Recht (Newsletter, Feedback)                            | MITTEL   | Double-Opt-in, Feedback nur mit Checkbox, Abmeldelink, `EmailLog`                          |
| Massenversand beim Drop-Alarm (Spam, Limits)                   | MITTEL   | Resend-Batch, eigene Domain mit SPF/DKIM/DMARC, Versand gestaffelt                         |
| Lastspitze beim Verkaufsstart (verstärkt durch den Drop-Alarm) | MITTEL   | Landingpage gecacht (ISR), Rate-Limiting, Lasttest                                         |
| Gutschein-Missbrauch                                           | NIEDRIG  | Limits pro Code und Kunde, serverseitige Prüfung                                           |
| Zeitzonen und Sommerzeit                                       | NIEDRIG  | UTC speichern, eigene Tests                                                                |
| Rechtliches (Impressum, DSGVO, Beleg-/TSE-Pflicht)             | MITTEL   | **Steuerberater zu Kassen- und Belegpflichten fragen**                                     |

---

## 7. Ideen für später (nicht in v1)

- Vorab-Zugang für Abonnenten des Drop-Alarms
- „Pizza ist fertig“-Mail oder SMS
- Vor-Ort-Bestellungen im Kitchen-Mode
- Smart Placement gegen Fragmentierung
- Mehrere Abholorte
- Englische Sprachversion
- Bondrucker bzw. Labels
- Stammkunden-Konto mit Bestellhistorie
- Instagram-Teaser-Bilder pro Drop
