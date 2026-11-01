# Pizza Drop Store

Pizza-Drops zum Vorbestellen: Kunden wählen Pizzen und eine Abholzeit, bezahlen online und holen zum gebuchten Slot ab. Dazu gibt es einen Admin-Bereich (Pizzen, Drops, Reporting) und einen Kitchen-Mode.

- Plan: [docs/PLAN.md](docs/PLAN.md)
- Design: [docs/DESIGN.md](docs/DESIGN.md)

## Stack

Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS v4 · shadcn/ui · Prisma 7 + PostgreSQL · Vitest · Playwright · Hosting auf Vercel.

## Lokal starten

Voraussetzung: Node.js 22 oder neuer.

```bash
npm install
cp .env.example .env      # Neon-Adressen des Zweigs "dev", SEED_PASSWORD, SESSION_SECRET
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Die lokale Entwicklung nutzt den Neon-Zweig `dev` (Projekt „Pizza Drop Store“, Frankfurt).
Adressen holen: `neon connection-string dev --pooled` (→ `DATABASE_URL`) und
`neon connection-string dev` (→ `DIRECT_URL`).

- Landingpage: http://localhost:3000
- Kitchen-Mode: http://localhost:3000/kitchen (nach dem Login als Küche oder Admin)
- Team-Login: http://localhost:3000/login mit `admin@pizzadrop.test` oder `kueche@pizzadrop.test` und dem `SEED_PASSWORD` aus `.env`

Ohne Neon geht es auch mit `npm run db:start` (prisma dev). Diese Datenbank erlaubt aber nur
eine Verbindung gleichzeitig: `DATABASE_POOL_MAX=1` setzen und Dev-Server und
`npm run test:e2e` nicht parallel laufen lassen.

## Produktion: ersten Admin anlegen

Mit der `DATABASE_URL` der Produktionsdatenbank:

```bash
ADMIN_EMAIL=du@example.com ADMIN_NAME="Dein Name" ADMIN_PASSWORD="…" npm run admin:create
```

In Vercel müssen außerdem `DATABASE_URL` und `SESSION_SECRET` gesetzt sein.

## Befehle

| Befehl                                                        | Zweck                                         |
| ------------------------------------------------------------- | --------------------------------------------- |
| `npm run dev`                                                 | Entwicklungsserver                            |
| `npm run lint` / `npm run typecheck` / `npm run format:check` | Qualität                                      |
| `npm test`                                                    | Unit-Tests (Vitest)                           |
| `npm run test:e2e`                                            | E2E-Tests (Playwright, mobil und Desktop)     |
| `npm run db:start` / `db:stop`                                | Alternative lokale Datenbank (prisma dev)     |
| `npm run db:migrate` / `db:seed` / `db:studio`                | Migrationen, Beispieldaten, Datenbank-Browser |
