# Design-Richtung: Pizza Drop Store

Erstellt mit dem ECC-Skill `frontend-design-direction`.

## Design-Vertrag

| Oberfläche   | Aufgabe des Nutzers                                        | Primäre Aktion                              | Was zuerst gescannt wird                                   | Ton                          |
| ------------ | ---------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------- | ---------------------------- |
| Kundenseite  | Nächsten Drop finden, Pizza und Abholzeit wählen, bezahlen | „Abholzeit sichern“                         | Datum und Uhrzeit des Drops, Restverfügbarkeit, Pizzakarte | Editorial, ruhig, warm       |
| Admin        | Pizzen, Drops und Bestellungen verwalten, Zahlen lesen     | Je Seite eine klare Hauptaktion oben rechts | Tabellen, Status, KPIs                                     | Funktional, dicht, leise     |
| Kitchen-Mode | Im Takt backen, nichts übersehen                           | „In den Ofen“ und „Fertig“                  | Jetzt-Pizza, Timer, Verzug                                 | Dunkel, hoher Kontrast, groß |

**Zielviewports:** `390x844` (Kunden am Handy), `1440x900` (Admin am Desktop), `1180x820` (Tablet im Querformat in der Küche).

## Erkennungsmerkmal: das Slot-Band

Ein schmales, horizontales Zeitband wie ein Lineal mit einem Strich pro 6-Minuten-Slot. Freie Slots sind nur als Linie zu sehen, belegte sind gefüllt, gesperrte schraffiert. Die gewählte Folge von Slots für eine Bestellung leuchtet in Olivgrün, die Abholzeit steht in Terrakotta am Ende.

Dasselbe Band wird verwendet:

- auf der Drop-Seite zur Auswahl der Abholzeit
- in der Admin-Ansicht des Slot-Rasters
- im Kitchen-Mode als Fortschrittsleiste des Drops

## Farben

| Token               | Hell      | Dunkel    | Zweck                                        |
| ------------------- | --------- | --------- | -------------------------------------------- |
| `--paper`           | `#F7F2E8` | `#1C1A16` | Hintergrund                                  |
| `--surface`         | `#FCFAF5` | `#25221D` | Karten, Formulare                            |
| `--ink`             | `#2B2620` | `#F4EFE4` | Text                                         |
| `--ink-muted`       | `#6F665A` | `#B5AC9C` | Sekundärtext (≥ 4.5:1)                       |
| `--line`            | `#E3D9C6` | `#3A352D` | Linien                                       |
| `--olive`           | `#5C6A3A` | `#A7B57A` | Primärfarbe (5.3:1 auf Papier)               |
| `--olive-deep`      | `#3F4927` | `#C3CF9A` | Hover                                        |
| `--olive-soft`      | `#DDE2C9` | `#2F3522` | Badges                                       |
| `--terracotta`      | `#A24A33` | `#E07A5F` | Akzent: Abholzeit, Knappheit, Verzug (5.3:1) |
| `--terracotta-soft` | `#F1D9CF` | `#3D2620` | Akzentflächen                                |
| `--ochre`           | `#B8893B` | `#D9A955` | Warnung, „bald ausverkauft“                  |

Die Akzentfarbe Terrakotta ist für Text abgedunkelt (`#A24A33` statt `#B4553D`), damit sie den Kontrast nach WCAG AA einhält. Ocker ergänzt die Palette, damit sie nicht nur aus Grün und Rot besteht.

## Typografie

- **Überschriften:** Cormorant Garamond 500/600; die Platzhalter-Wortmarke ist kursiv.
- **Text, Admin, Zahlen:** DM Sans 400/500/600 mit `tabular-nums` für Uhrzeiten, Preise und Timer.
- **Skala auf der Kundenseite:** Fließtext 17 px, H1 40–64 px fluid; im Admin-Bereich 14 px Grundgröße.

## Formen und Bewegung

- Radius 6 px, Linien statt Schatten, keine Karten in Karten.
- Bewegung nur zur Orientierung: die gewählten Slots füllen sich (150 ms), Statuswechsel in der Küche gleiten (200 ms). `prefers-reduced-motion` wird respektiert.

## Zustände

| Zustand      | Kundenseite                                                                                                                 | Admin                                                              | Küche                                                     |
| ------------ | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------- |
| Laden        | Skeleton im Layout der Pizzakarte und des Slot-Bands                                                                        | Skeleton-Tabellenzeilen                                            | Letzter Snapshot bleibt stehen, Hinweis „aktualisiere…“   |
| Leer         | „Gerade kein Drop geplant“ + Drop-Alarm-Anmeldung                                                                           | „Noch keine Pizzen. Erste Pizza anlegen“                           | „Noch keine Bestellungen. Nächster Slot hh:mm“            |
| Fehler       | Klare Meldung + „Erneut versuchen“; Zahlung abgebrochen → zurück zur Auswahl, Reservierung läuft noch mm:ss                 | Feldfehler inline, Toast für Serverfehler                          | Offline-Banner in Terrakotta, Aktionen werden gepuffert   |
| Teilweise    | Einzelne Sorten ausverkauft und ausgegraut; Abholzeiten für die gewählte Menge nicht verfügbar → kleinere Menge vorschlagen | Reporting: fehlende Zeiträume markiert                             | Ein Gerät hängt hinterher → Zeitstempel des Snapshots     |
| Erfolg       | Bestätigung mit Abholzeit groß, QR-Code, „In Kalender eintragen“                                                            | Toast + Rückkehr zur Liste                                         | Haptisches bzw. farbliches Feedback, Karte gleitet weiter |
| Berechtigung | – (öffentlich)                                                                                                              | Login; `KITCHEN` sieht im Admin-Bereich nur Küche und Bestellungen | Ohne Login Weiterleitung zum Login                        |

## Anti-Pattern, die wir vermeiden

- Keine Verläufe, Blobs oder generischen Hero-Sprüche
- Der Drop selbst (Datum, Pizzen, Abholzeit) steht im ersten Viewport, nicht hinter Marketing-Sektionen
- Keine Stock-Fotos als Füller: bis echte Fotos vorliegen, ruhige Platzhalter im Seitenverhältnis 4:3 mit dem Namen der Pizza
