# TDD-Nachweis Phase 3: Kundenseite & Reservierung

**Quelle:** `docs/PLAN.md` (1.1 Kundenbereich, 3.2 Slot-Modell & Buchung). Die Journeys wurden in diesem Lauf daraus abgeleitet.
**ECC:** `tdd-workflow`, `frontend-design-direction`, Reviews durch die Agenten `react-reviewer` (inkl. Barrierefreiheit) und `typescript-reviewer`

## User Journeys

- Als Kunde sehe ich auf der Startseite den nächsten Drop mit Uhrzeit, freien Pizzen und Verkaufsstart (Countdown).
- Als Kunde wähle ich Pizzen und sehe nur Abholzeiten, für die genug Slots am Stück frei sind. Die Abholzeit ist das Ende des letzten Slots.
- Als Kunde gebe ich Name, Telefon und E-Mail an und reserviere. Meine Slots sind dann für die Reservierungszeit (Standard 10 min) für mich gehalten.
- Wenn mir jemand zuvorkommt, erfahre ich das sofort und sehe die aktuelle Auswahl.
- Meine Bestellseite ist nur über den persönlichen Link erreichbar.

## RED → GREEN

| Schritt                                             | RED                                                                                                      | GREEN                                   |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Buchungs-Domäne, Checkout-Validierung, Bestell-Link | `f9dc094`: vitest bricht ab, weil die Module `./booking` und `./order-link` fehlen                       | `220097d`: 129 Unit-Tests grün (34 neu) |
| Atomare Reservierung gegen die Datenbank            | `5e8b139`: `npm run test:integration` bricht ab, weil `./reserve` fehlt                                  | `9911a10`: 7 Integrationstests grün     |
| Gegenprobe                                          | Ohne `FOR UPDATE` schlagen die Tests „20 gleichzeitige Checkouts“ und „Sortenkontingent unter Last“ fehl | Mit Sperre wieder grün                  |
| Review: Kundendaten, Mehrfachreservierung           | 2 neue Integrationstests schlagen fehl (Spalte fehlt, alte Reservierung bleibt)                          | `0953869`: 9 Integrationstests grün     |

## Was die Tests garantieren

| #   | Garantie                                                                                                                                                           | Test                                             | Art         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ | ----------- |
| 1   | Abholzeiten nur aus n freien Slots am Stück mit lückenloser Nummerierung, frühestens nach der Reservierungszeit; reservierte und gesperrte Slots zählen als belegt | `src/lib/domain/booking.test.ts` › pickupOptions | Unit        |
| 2   | Restkapazität = freie Slots, gedeckelt durch Obergrenze minus verkaufte und reservierte                                                                            | › remainingCapacity                              | Unit        |
| 3   | Preise und Namen kommen vom Server; Höchstmenge, Sortenkontingent, Gesamtrest und ungültige Mengen werden mit deutschen Meldungen abgelehnt                        | › checkCart                                      | Unit        |
| 4   | Enthaltene MwSt. wird aus dem Bruttopreis herausgerechnet, Rabatt nie unter 0                                                                                      | › priceBreakdown                                 | Unit        |
| 5   | Offene Zahlungen belegen nur bis zum Ablauf                                                                                                                        | › isOrderActive                                  | Unit        |
| 6   | Abholcode: 6 Zeichen ohne verwechselbare Zeichen, gleichverteilt                                                                                                   | › generatePickupCode                             | Unit        |
| 7   | Checkout-Daten werden normalisiert und feldgenau abgelehnt                                                                                                         | `src/lib/validation/booking.test.ts`             | Unit        |
| 8   | Bestell-Link nur mit passendem HMAC-Schlüssel gültig                                                                                                               | `src/lib/booking/order-link.test.ts`             | Unit        |
| 9   | 20 gleichzeitige Checkouts auf dieselbe Zeit: genau eine Bestellung, Slots genau einmal vergeben                                                                   | `src/lib/booking/reserve.integration.test.ts`    | Integration |
| 10  | Obergrenze (10 von 20) und Sortenkontingent (3 von 6) halten unter paralleler Last                                                                                 | › reserveOrder                                   | Integration |
| 11  | Abgelaufene Reservierungen geben Slots frei; Entwürfe sind nicht buchbar                                                                                           | › reserveOrder                                   | Integration |
| 12  | Ein bestehender Kunde wird nicht überschrieben; der Kontakt steht an der Bestellung                                                                                | › reserveOrder                                   | Integration |
| 13  | Pro E-Mail eine offene Reservierung je Drop; eine neue Buchung löst die alte ab                                                                                    | › reserveOrder                                   | Integration |
| 14  | Buchung zweier Pizzen bis zur Reservierungsseite, Konflikt zweier Kunden (Meldung mit Fokus, Zeit verschwindet), Feldfehler, Link-Schutz                           | `e2e/booking.spec.ts` (mobil und Desktop)        | E2E         |

## Befehle und Ergebnisse (zuletzt ausgeführt)

- `npm test`: 129 Tests bestanden
- `npm run test:integration` (Neon-Zweig `dev`): 9 Tests bestanden
- `npx playwright test`: 22 bestanden (zweimal hintereinander stabil)
- `npm run typecheck`, `npm run lint`, `npx prettier --check src e2e`: sauber
- Sichtprüfung im Browser auf Mobil (375 px) und Desktop: Startseite, Drop-Seite mit Auswahl, Reservierungsseite. Dabei gefunden und behoben: Nach erfolgreicher Buchung erschien fälschlich die Fehlermeldung, weil `redirect()` im Client als Ausnahme ankam.

## Reviews und Umgang damit

- **Behoben (typescript-reviewer):**
  - Kontaktdaten stehen jetzt an der Bestellung. Einen bestehenden Kundendatensatz kann niemand mehr über die E-Mail überschreiben.
  - Mehrfachreservierung: Pro E-Mail gibt es je Drop eine offene Reservierung.
  - Die Zeit wird erst nach der Sperre gesetzt.
  - P2028 erscheint als Lastmeldung.
  - Das Slot-Update nutzt die vollständige Frei-Regel.
  - Es gibt Längengrenzen.
  - Es gibt ein eigenes Link-Secret.
  - `no-referrer` für Bestellseiten.
- **Behoben (react-reviewer):**
  - Kein Doppel-Absenden.
  - Fokus und Ansage von Fehlern.
  - Mengen nach einem Konflikt werden gedeckelt.
  - Die Auswahl wird bei Mengenänderung zurückgesetzt.
  - Live-Region.
  - Countdown ohne Neulade-Schleife.
  - Skip-Link.
  - `motion-safe`.
  - Scroll-Abstand zur mobilen Leiste.
  - Statustexte auf der Bestellseite.
- **Bewusst offen:**
  - Rate-Limiting pro IP (Upstash) folgt in Phase 10, vor dem Go-Live. Bis dahin begrenzt die Regel „eine offene Reservierung pro E-Mail“ das Horten nur teilweise.
  - Für Phase 4 (Stripe-Webhook):
    - Der Webhook nimmt dieselbe Drop-Sperre.
    - Vor `PAID` prüft er, ob die Bestellung ihre Slots noch hält; sonst erstattet er und setzt `EXPIRED`.
    - Die Stripe-Session läuft spätestens mit `expiresAt` ab.
    - Bei Storno werden Tickets gelöscht und Slots geleert.
  - Seitentitel pro Drop (`generateMetadata`) und echter 404-Status für unbekannte Drops (heute 200 mit Nicht-gefunden-Inhalt, weil im Stream).
  - Idempotenz-Schlüssel, falls die Antwort nach erfolgreicher Reservierung verloren geht.
  - Automatische Aktualisierung einer lange offenen Drop-Seite.
