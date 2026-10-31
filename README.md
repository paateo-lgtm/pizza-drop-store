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
cp .env.example .env      # SEED_PASSWORD setzen
npm run db:start          # lokale Postgres-Datenbank (prisma dev, ohne Docker)
npm run db:migrate
npm run db:seed
npm run dev
```

- Landingpage (Entwurf): http://localhost:3000
- Kitchen-Mode (Entwurf): http://localhost:3000/entwurf/kueche

## Befehle

| Befehl                                                        | Zweck                                         |
| ------------------------------------------------------------- | --------------------------------------------- |
| `npm run dev`                                                 | Entwicklungsserver                            |
| `npm run lint` / `npm run typecheck` / `npm run format:check` | Qualität                                      |
| `npm test`                                                    | Unit-Tests (Vitest)                           |
| `npm run test:e2e`                                            | E2E-Tests (Playwright, mobil und Desktop)     |
| `npm run db:start` / `db:stop`                                | Lokale Datenbank starten/stoppen              |
| `npm run db:migrate` / `db:seed` / `db:studio`                | Migrationen, Beispieldaten, Datenbank-Browser |
