import "dotenv/config";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Integrationstests laufen gegen die Datenbank aus DATABASE_URL (lokal: Neon-Zweig "dev").
// Sie legen eigene Daten an und räumen sie wieder ab.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // "server-only" wirft außerhalb von React Server Components; im Test ist es leer.
      "server-only": fileURLToPath(
        new URL("./test/server-only-stub.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
