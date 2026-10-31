/**
 * Legt einen Admin-Zugang an oder setzt dessen Passwort neu, z. B. für die erste
 * Anmeldung in der Produktion. Fehlende Angaben werden abgefragt, das Passwort verdeckt:
 *
 *   npm run admin:create
 *   ADMIN_EMAIL=… ADMIN_NAME=… ADMIN_PASSWORD=… npm run admin:create   (ohne Rückfragen)
 *
 * Verbindet sich mit der Datenbank aus DATABASE_URL.
 */
import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { emailSchema, passwordSchema } from "../src/lib/validation/auth";

async function ask(question: string, hidden = false): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  if (hidden) {
    // Eingabe nicht anzeigen: nur die Frage ausgeben, Tastendrücke unterdrücken.
    const writeOriginal = process.stdout.write.bind(process.stdout);
    let prompted = false;
    process.stdout.write = ((
      chunk: string | Uint8Array,
      ...rest: unknown[]
    ) => {
      if (!prompted) {
        prompted = true;
        return writeOriginal(chunk, ...(rest as []));
      }
      return true;
    }) as typeof process.stdout.write;
    try {
      return await rl.question(question);
    } finally {
      process.stdout.write = writeOriginal;
      process.stdout.write("\n");
      rl.close();
    }
  }
  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? "postgres://unbekannt").host;
  console.log(`Datenbank: ${host}`);

  const email = emailSchema.parse(
    process.env.ADMIN_EMAIL ?? (await ask("E-Mail: ")),
  );
  const name =
    (process.env.ADMIN_NAME ?? (await ask("Name: "))).trim() || "Admin";
  const password = passwordSchema.parse(
    process.env.ADMIN_PASSWORD ??
      (await ask("Passwort (mind. 10 Zeichen, wird nicht angezeigt): ", true)),
  );

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
      update: {
        passwordHash,
        role: "ADMIN",
        active: true,
        sessionVersion: { increment: 1 },
      },
      create: { email, name, passwordHash, role: "ADMIN" },
    });
    console.log(`Admin-Zugang bereit: ${user.email}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error && "issues" in error
      ? (error as { issues: { message: string }[] }).issues
          .map((i) => i.message)
          .join(", ")
      : error instanceof Error
        ? error.message
        : error,
  );
  process.exitCode = 1;
});
