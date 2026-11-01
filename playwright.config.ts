import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";
import { WEBHOOK_SECRET } from "./e2e/support/webhook";

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    // Webhook-Tests signieren Events selbst; ohne echtes Secret gilt ein Test-Secret.
    env: {
      STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
      APP_URL: `http://localhost:${PORT}`,
    },
  },
});
