---
name: prod-migrate
description: Prisma-Migrationen vor einem Push auf die Neon-Produktion anwenden, mit Vorabprüfung. Nur auf ausdrücklichen Wunsch des Nutzers.
disable-model-invocation: true
---

# Migrationen auf Produktion anwenden

Der Vercel-Build führt keine Migrationen aus. Darum vor jedem Push, der neue Ordner unter `prisma/migrations/` enthält, diesen Ablauf nutzen. Neon-Projekt `little-pine-70647821`, Zweig `production`.

1. **Offene Migrationen ermitteln:** `git diff --name-only origin/main..HEAD -- prisma/migrations`. Ist die Liste leer, ist hier nichts zu tun.
2. **Jede neue `migration.sql` lesen** und Risiken nennen:
   - `NOT NULL` ohne Vorgabewert
   - `DROP`
   - Unique-Indizes auf bestehenden Daten
3. **Vorabprüfung auf Produktion, nur lesend:**
   - Für jede betroffene Tabelle die Zeilen zählen, z. B. `SELECT count(*) FROM "WaitlistEntry"` vor einer NOT-NULL-Spalte.
   - Ausführen per Neon-MCP (`run_sql`, Zweig `production`) oder `neon` CLI.
   - Das Ergebnis dem Nutzer zeigen.
4. **Status prüfen** und dem Nutzer mit genauer Liste zur Bestätigung vorlegen:
   ```bash
   DIRECT_URL="$(neon connection-string production --project-id little-pine-70647821)" npx prisma migrate status
   ```
5. **Erst nach ausdrücklichem Ja anwenden:**
   ```bash
   DIRECT_URL="$(neon connection-string production --project-id little-pine-70647821)" npx prisma migrate deploy
   ```
   Den Connection-String nie ausgeben.
6. **Danach** erneut `migrate status` ausführen und das Ergebnis berichten. Gepusht wird erst danach, und nur auf Wunsch.
