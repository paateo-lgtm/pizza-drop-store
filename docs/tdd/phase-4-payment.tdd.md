# TDD-Nachweis Phase 4: Zahlung & Mails

**Quelle:** `docs/PLAN.md` (1.1 Checkout/Bestätigung, 1.2 Bestellungen, 3.2 Schritte 4–7) sowie die Phase-4-Vorgaben aus dem Review in `phase-3-booking.tdd.md`.
**ECC:** `tdd-workflow`; Reviews durch die Agenten `security-reviewer` und `silent-failure-hunter`

## User Journeys

- Als Kunde bezahle ich meine Reservierung über Stripe (Karte, Apple Pay, Google Pay). Danach sehe ich meinen Abholcode als QR-Code und bekomme eine Bestätigungsmail.
- Als Kunde, der zu spät zahlt, bekomme ich die Bestellung trotzdem, wenn meine Slots noch frei sind. Sonst bekomme ich automatisch mein Geld zurück.
- Als Admin sehe ich alle Bestellungen und storniere eine Bestellung. Bezahlte Bestellungen werden erstattet, die Slots werden frei, und der Kunde bekommt eine Mail.

## RED → GREEN

| Schritt                                        | RED                                                                            | GREEN                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------- |
| Zahlungsregeln                                 | `f31dc7a`: vitest bricht ab, weil `./payment` fehlt                            | `9a8fcde`: 140 Unit-Tests grün                |
| Zahlungseingang und Storno gegen die Datenbank | `cd842b9`: `test:integration` bricht ab, weil `./settle` und `./cancel` fehlen | `e972c7d`: 18 Integrationstests grün          |
| Webhook (Signatur, Events)                     | `b66b68b`: vitest bricht ab, weil `./webhook` fehlt                            | `afd6fef`: 4 Tests grün                       |
| Doppelte Zahlung (zwei Zahlfenster)            | neuer Integrationstest schlägt fehl: die zweite Zahlung wird behalten          | `a4883d6`: wird erstattet                     |
| Review: Betrag/Währung                         | neuer Integrationstest schlägt fehl: ein abweichender Betrag wird angenommen   | `22a4891`: der gezahlte Betrag wird erstattet |

## Was die Tests garantieren

| #   | Garantie                                                                                                                                                                    | Test                                         | Art         |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ----------- |
| 1   | Webhook-Entscheidung: annehmen nur, wenn die Bestellung alle Slots hält (auch verspätet); sonst erstatten; bezahlte Bestellungen sind Duplikate                             | `src/lib/domain/payment.test.ts`             | Unit        |
| 2   | Tickets: eine Pizza pro Slot in seq-Reihenfolge; die Anzahl muss passen                                                                                                     | › assignTickets                              | Unit        |
| 3   | Storno: offene Bestellungen ohne Erstattung, bezahlte mit Erstattung, abgeschlossene gar nicht                                                                              | › cancellationFor                            | Unit        |
| 4   | Nur korrekt signierte Stripe-Events zählen; verzögerte Zahlarten erst bei `async_payment_succeeded`; fremde Events werden ignoriert                                         | `src/lib/payment/webhook.test.ts`            | Unit        |
| 5   | Zahlung angenommen: Status PAID, Tickets, Slots fest, Kunde mit erster Bestellung, genau eine Mail                                                                          | `src/lib/payment/settle.integration.test.ts` | Integration |
| 6   | Dasselbe Event bei 5 parallelen Zustellungen nur einmal verarbeitet                                                                                                         | › settleCheckout                             | Integration |
| 7   | Verspätete Zahlung: Slots vergeben → Erstattung; Slots frei → angenommen                                                                                                    | › settleCheckout                             | Integration |
| 8   | Zweite Zahlung derselben Bestellung und abweichender Betrag werden erstattet                                                                                                | › settleCheckout                             | Integration |
| 9   | Scheitert die Erstattung, bleibt alles unverändert und Stripe stellt erneut zu                                                                                              | › settleCheckout                             | Integration |
| 10  | Admin-Storno: Erstattung, Tickets gelöscht, Slots frei; scheitert Stripe, bleibt die Bestellung unverändert                                                                 | › cancelOrder                                | Integration |
| 11  | Mails höchstens einmal; übersprungene und hängengebliebene Mails bleiben wiederholbar                                                                                       | `src/lib/mail/send.integration.test.ts`      | Integration |
| 12  | Echte Reservierung, Rückkehr von Stripe („wird bestätigt“), signiertes Event an den Testserver, Duplikat, Statusseite mit QR-Code; gefälschtes Event → 400; Admin storniert | `e2e/payment.spec.ts` (mobil und Desktop)    | E2E         |

## Befehle und Ergebnisse (zuletzt ausgeführt)

- `npm test`: 144 Tests bestanden
- `npm run test:integration` (Neon-Zweig `dev`): 23 Tests bestanden
- `npx playwright test`: 28 bestanden (mehrfach stabil)
- `npm run typecheck`, `npm run lint`, `npx prettier --check src e2e`: sauber

## Reviews und Umgang damit

- **Behoben:**
  - Mails:
    - Gescheiterte oder übersprungene Mails sind wiederholbar.
    - Admin: Mailstatus und „Erneut senden“.
  - Zahlung und Webhook:
    - Zahlung nur mit Webhook-Secret.
    - Das Test-Secret ist in Produktion gesperrt.
    - Prüfung von Betrag und Währung.
    - Abgleich mit Stripe bei der Rückkehr.
    - Kein zweites Zahlfenster für bezahlte Sessions.
    - Stripe-Timeout 8 s.
  - Storno:
    - Offene Session schließen.
    - Klare Fehlermeldungen.
    - Fehlerbehandlung in `startPayment`.
  - Fehler, wenn in Produktion die App-Adresse fehlt.
- **Bewusst offen:**
  - **Keine automatische Erstattung bei unbekannter Bestellung.** Entwicklung, Vorschau und Produktion teilen sich im Testmodus ein Stripe-Konto, und jeder Endpunkt bekommt alle Events. Das wird als Fehler protokolliert und muss im Live-Modus geprüft werden.
  - **Erstattungen laufen unter der Drop-Sperre.** Das Timeout von 8 s begrenzt die Wartezeit. Ein Zustand „Erstattung läuft“ außerhalb der Transaktion wäre eine spätere Verbesserung.
  - **Ein automatischer Wiederholungs-Job für Mails** kommt mit den Cron-Jobs in Phase 7. Bis dahin sendet der Admin manuell erneut.
  - **Rate-Limiting** für `startPayment` folgt in Phase 10.
  - **Das Ablaufen offener Sessions** bei ablaufender Reservierung kommt mit dem Aufräum-Cron (Phase 7). Bis dahin fängt der Webhook späte Zahlungen ab.
  - **ORDER_LINK_SECRET** sollte in Vercel gesetzt werden.
- **Mit echtem Stripe (Sandbox) geprüft am 2026-11-01:**
  - Reservierung (2 × Margherita, 21,00 €), Zahlung mit der Testkarte 4242 in Stripe Checkout.
  - `stripe listen` leitet `checkout.session.completed` weiter, der Webhook antwortet 200.
  - Bestellung `PAID` mit Payment-Intent, 2 Küchen-Tickets, Statusseite mit Abholcode und QR-Code.
  - Admin-Storno: Bestellung `REFUNDED`, Tickets gelöscht, Erstattung über 21,00 € in Stripe `succeeded`.
  - Mails nur protokolliert („nicht-gesendet“), weil `RESEND_API_KEY` fehlt.
- **Mailversand:** Mit Schlüssel scheiterte jede Mail, weil Resend `@react-email/render` nicht fand (nur verschachtelt installiert). RED `411e65a`, GREEN `d0a5588` (direkte Abhängigkeit, Test `src/emails/order-mail.test.tsx`).
- **Live-Test in Produktion am 2026-11-01:** Bestellung über pizza-drop-store.vercel.app mit Stripe-Sandbox bezahlt (`PAID`, 1 Küchen-Ticket). Bestätigungs- und Storno-Mail von Resend angenommen und zugestellt. Admin-Storno: `REFUNDED`, Tickets gelöscht, Erstattung über 14,50 € `succeeded`, Drop wieder 30 von 30 frei.
