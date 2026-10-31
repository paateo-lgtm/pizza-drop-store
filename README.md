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
- Team-Login: http://localhost:3000/login mit `admin@pizzadrop.test` oder `kueche@pizzadrop.test` und dem `SEED_PASSWORD` aus `.env`

Die lokale Datenbank (`prisma dev`) erlaubt nur eine Verbindung gleichzeitig. Deshalb
`DATABASE_POOL_MAX=1` setzen und Dev-Server und `npm run test:e2e` nicht parallel laufen lassen.

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
| `npm run db:start` / `db:stop`                                | Lokale Datenbank starten/stoppen              |
| `npm run db:migrate` / `db:seed` / `db:studio`                | Migrationen, Beispieldaten, Datenbank-Browser |
