/**
 * Legt einen Admin-Zugang an oder setzt dessen Passwort neu, z. B. für die erste
 * Anmeldung in der Produktion:
 *
 *   ADMIN_EMAIL=… ADMIN_NAME=… ADMIN_PASSWORD=… npm run admin:create
 *
 * Verbindet sich mit der Datenbank aus DATABASE_URL.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { emailSchema, passwordSchema } from "../src/lib/validation/auth";

async function main() {
  const email = emailSchema.parse(process.env.ADMIN_EMAIL);
  const name = process.env.ADMIN_NAME?.trim() || "Admin";
  const password = passwordSchema.parse(process.env.ADMIN_PASSWORD);

  const db = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL!,
      max: 1,
    }),
  });
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await db.user.upsert({
      where: { email },
      update: { passwordHash, role: "ADMIN", active: true },
      create: { email, name, passwordHash, role: "ADMIN" },
    });
    console.log(`Admin-Zugang bereit: ${user.email}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
