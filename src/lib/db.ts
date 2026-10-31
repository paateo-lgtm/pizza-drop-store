import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL ist nicht gesetzt");
  }
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      // Lokal (prisma dev) ist nur eine Verbindung gleichzeitig möglich, siehe .env.example.
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    }),
  });
}

// In der Entwicklung über Hot-Reloads hinweg nur eine Verbindung aufbauen.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
