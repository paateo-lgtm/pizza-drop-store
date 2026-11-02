# TDD-Nachweis Phase 7c: Gutscheincodes

**Quelle:** `docs/PLAN.md` (1.6 Gutscheincodes, Phase 7 in Abschnitt 5).
**ECC:**

- Skill: `tdd-workflow`
- Review durch den Agenten `code-reviewer` (Modell opus, weil es um Zahlungen geht)
- Prüfung im Browser: `browser-qa`, dazu ein echter Checkout gegen die Stripe-Sandbox

## User Journeys

- Als Admin lege ich Codes an: Prozent oder fester Betrag, gültig von–bis, Grenzen gesamt und pro Kunde, optional nur für bestimmte Drops. In der Liste sehe ich Einlösungen und Rabattsumme.
- Als Kunde gebe ich im Checkout einen Code ein. Die Bestellseite zeigt den Rabatt, Stripe berechnet genau den reduzierten Betrag.

## Entscheidungen

- **Keine Migration:** `Coupon`, `CouponDrop`, `Order.couponId` und `Order.discountCents` gab es schon seit Phase 0.
- **Einlösung bei der Reservierung,** nicht erst bei Stripe.
  - Preis und Grenzen werden unter Drop-Sperre und danach Gutschein-Sperre (`lockCoupon`) geprüft. Die Reihenfolge ist überall gleich: erst Drops, dann Gutschein.
  - Eine Einlösung belegen bezahlte Bestellungen und laufende Reservierungen. Stornierte, erstattete und verfallene Bestellungen geben sie frei.
  - Die Grenze pro Kunde zählt pro E-Mail-Adresse.
- **Stripe:** pro Bestellung ein einmaliger Coupon über genau `discountCents` (`duration: once`, `max_redemptions: 1`, Idempotenz pro Bestellung). Damit gilt `amount_total = totalCents`, und die Betragsprüfung im Webhook bleibt unverändert.
- **Späte Zahlung:** Kommt die Zahlung nach Ablauf der Reservierung, prüft der Webhook die Grenzen neu und erstattet, wenn der Gutschein inzwischen vergeben ist.
- **Mindestbetrag 0,50 €** (Stripe-Minimum). Kostenlose Bestellungen ohne Stripe kommen erst bei Bedarf.
- **Unbekannt und deaktiviert** geben dieselbe Meldung.
- **Reporting:** Die Gutschein-Liste zeigt Einlösungen und Rabattsumme bezahlter Bestellungen. Eine eigene Reporting-Seite folgt in Phase 8.

## RED → GREEN

| Schritt                                                   | RED                                                       | GREEN                                         |
| --------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------- |
| Regeln, Admin-Validierung, Einlösung bei der Reservierung | `f7ff3ba`: 14 Unit- und 7 Integrationstests schlagen fehl | `3572c88`: 218 Unit, 17 Integration (Buchung) |
| Review: parallele Neuanmeldung, späte Zahlung             | `77a76ca`: 2 Integrationstests schlagen fehl              | `d79077e`: 31 Integration (Buchung, Zahlung)  |

## Was die Tests garantieren

| #   | Garantie                                                                                                                   | Test                                         | Art         |
| --- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ----------- |
| 1   | Code ohne Leerzeichen, großgeschrieben; Prozent kaufmännisch gerundet; fester Betrag höchstens Zwischensumme               | `src/lib/domain/coupon.test.ts`              | Unit        |
| 2   | Unbekannt = deaktiviert; Zeitraum inklusive Ende; Drop-Zuordnung; Grenzen gesamt und pro Kunde; 0,50 €-Minimum             | › checkCoupon                                | Unit        |
| 3   | Admin-Formular: Code-Format, Prozent 1–100, Euro-Beträge, Berliner Zeit, Widersprüche in Zeitraum und Grenzen              | `src/lib/validation/coupon.test.ts`          | Unit        |
| 4   | Rabatt vom Server, Gutschein an der Bestellung; unbekannter Code reserviert nichts; nur zugeordnete Drops                  | `src/lib/booking/coupon.integration.test.ts` | Integration |
| 5   | Letzte Einlösung nur einmal, auch über zwei Drops gleichzeitig; Freigabe nach Verfall; eigene Ablösung zählt nicht doppelt | › Gutschein bei der Reservierung             | Integration |
| 6   | Pro-Kunde-Grenze bei paralleler Neuanmeldung; späte Zahlung wird erstattet, wenn vergeben, sonst angenommen                | › Review                                     | Integration |
| 7   | Admin legt Gutschein an und sieht ihn in der Liste; Kunde löst ein, Fehler am Feld, Rabatt auf der Bestellseite            | `e2e/coupons.spec.ts` (mobil und Desktop)    | E2E         |

## Befehle und Ergebnisse (zuletzt ausgeführt)

- `npm test`: 218 Tests bestanden
- `npm run test:integration`: 65 Tests bestanden
- `npx playwright test`: 48 bestanden, 4 übersprungen
- `npm run typecheck`, `npm run lint`: sauber

## browser-qa (lokal)

- **Stripe-Sandbox:** Reservierung mit 15 % auf 21,00 €. Die Bestellseite zeigt −3,15 € und 17,85 €, der Stripe-Checkout zeigt 17,85 € mit „Gutschein · Bestellung …“. Bezahlt wurde nicht.
- **axe-core** (WCAG 2.2 AA, lokal aus `node_modules`): Checkout mit Gutscheinfeld, Admin-Liste, Neu und Bearbeiten: 0 Verstöße, mobil und Desktop.
- **Nebenbei behoben:** Das Lade-Gerüst im Admin und auf der Login-Seite trug `aria-label` ohne Rolle (`aria-prohibited-attr`). Es hat jetzt `role="status"`.

## Review und Umgang damit

- **Behoben:**
  - **Späte Zahlung über das Limit (MEDIUM):** Nach Ablauf der Reservierung war die Einlösung frei. Der Webhook prüft jetzt unter Sperre neu und erstattet.
  - **Pro-Kunde-Grenze bei paralleler Neuanmeldung:** Zählung pro E-Mail statt pro Kundendatensatz.
  - **Deadlock-Gefahr beim Speichern im Admin:** gleiche Sperrreihenfolge wie die Reservierung.
  - **Idempotenz bei Stripe:** Der Coupon-Name hängt an der Bestellnummer, nicht am änderbaren Code.
  - **Doppelte Meldung im Formular:** Feldfehler am Gutscheinfeld, oben nur „Bitte den Gutscheincode prüfen.“
- **Bewusst offen:**
  - **Codes erraten:** Die genauen Meldungen (abgelaufen, anderer Drop, eingelöst) verraten, dass ein Code existiert. Raten braucht einen gültigen Warenkorb. Pro-IP-Limit folgt in Phase 10.
  - **Begrenzte Codes blockieren:** Wer einen begrenzten Code kennt, kann ihn mit Wegwerf-Adressen für die Reservierungszeit belegen. Andere Adressen umgehen die Grenze pro Kunde.
  - **100 % oder sehr hohe feste Beträge** lassen sich anlegen, scheitern aber immer am 0,50 €-Minimum.
  - **Kein Index auf `Order.couponId`:** Erst bei vielen Bestellungen nötig, dann mit der nächsten Migration.
