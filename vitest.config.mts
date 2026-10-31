import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    // Fachlogik läuft in Node; Komponententests setzen per Kommentar `@vitest-environment jsdom`.
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    // Datenbanktests: npm run test:integration
    exclude: [...configDefaults.exclude, "src/**/*.integration.test.ts"],
    coverage: {
      include: ["src/lib/**"],
    },
  },
});
