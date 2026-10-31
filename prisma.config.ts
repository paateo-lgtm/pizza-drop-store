import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrationen brauchen eine direkte Verbindung; Neons gepoolte Adresse (DATABASE_URL)
    // ist für die App. DATABASE_URL_UNPOOLED setzt die Neon-Integration in Vercel.
    // Ohne beide (z. B. CI mit eigenem Postgres) gilt DATABASE_URL.
    url:
      process.env["DIRECT_URL"] ??
      process.env["DATABASE_URL_UNPOOLED"] ??
      process.env["DATABASE_URL"],
    shadowDatabaseUrl: process.env["SHADOW_DATABASE_URL"],
  },
});
