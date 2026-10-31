import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    // Fachlogik läuft in Node; Komponententests setzen per Kommentar `@vitest-environment jsdom`.
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      include: ["src/lib/**"],
    },
  },
});
