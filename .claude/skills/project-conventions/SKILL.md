---
name: project-conventions
description: Arbeitsregeln für den Pizza Drop Store (Sprache, TDD, Commits, Push-Sperre, Tests, bekannte Fallstricke). Gilt bei jeder Code- oder Doku-Änderung in diesem Repository.
user-invocable: false
---

# Arbeitsregeln Pizza Drop Store

Stack: Next.js 16 (siehe `AGENTS.md`, Doku unter `node_modules/next/dist/docs/`), Prisma 7 auf Neon, Stripe, Resend, Vercel. Plan: `docs/PLAN.md`.

## Ablauf

- Antworten auf Deutsch.
- Vor größeren Arbeitspaketen zuerst den Skill `model-route`.
- TDD: erst RED-Commit (Tests plus Stub), dann GREEN-Commit. Den Nachweis pro Phase in `docs/tdd/phase-<n>-<name>.tdd.md` festhalten.
- Nach jeder Phase ein Review per Agent (`ecc:code-reviewer`, bei Zahlung oder Sicherheit auf opus). Befunde wieder per RED/GREEN beheben.
- Commits nur lokal. **Kein Push** ohne ausdrücklichen Auftrag des Nutzers. Migrationen vorher auf Produktion anwenden (Skill `prod-migrate`).
- Markdown nur mit Write/Edit schreiben, nie per Shell-Heredoc oder `node -e`: Die Shell führt Backticks aus.
- Keine Secrets ausgeben. `.env` nicht lesen; der Hook blockiert das ohnehin.

## Prüfen

- `npm test`, `npm run test:integration` (gegen den Neon-Zweig `dev`), `npx playwright test`, `npx tsc --noEmit`, `npx eslint src e2e`.
- Nach neuen Routen `npx next typegen`. Veraltete Typen in `.next/dev/types` löschen (absoluter Pfad).
- Integrationstests teilen sich die Datenbank: Daten pro Lauf mit Präfix anlegen und aufräumen; Ergebnisse auf die eigenen Daten filtern.
- axe-core nicht aus dem CDN laden (wird blockiert), sondern `node_modules/axe-core/axe.min.js` per Playwright `addScriptTag({ path })` einbinden.
- Login in Skripten nur über `process.env.SEED_PASSWORD` im Skript, den Wert nie selbst auslesen.

## Bekannte Fallstricke

- Kein Formular in `closedNote` des Bestellformulars: `OrderForm` ist selbst ein `<form>`; verschachtelte Formulare verwirft der Browser.
- Prisma-Indizes mit `ops: raw(...)` erscheinen bei jedem Abgleich als Abweichung, also vermeiden.
- Sperrreihenfolge in Transaktionen: erst `lockDrop`, dann `lockCoupon` (`src/lib/tx.ts`).
- Persönliche Links (`?k=`, `?t=`) brauchen `Referrer-Policy: no-referrer` in `next.config.ts`; ausgelöst wird nur per Knopf (POST), nie beim Öffnen.
- `npm install` unter Windows streicht plattformabhängige Einträge (`@emnapi/*`) aus `package-lock.json`, dann scheitert `npm ci` in der CI. Nach jeder Änderung an den Abhängigkeiten den Workflow „Lockfile erneuern“ starten (`gh workflow run lockfile.yml`), das Artefakt mit `gh run download --name package-lock` holen und committen. Ein lokal umgeschriebenes Lockfile nicht committen.
