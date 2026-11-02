import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";
import { CRON_TEST_SECRET } from "./e2e/support/cron";
import { WEBHOOK_SECRET } from "./e2e/support/webhook";

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/support/global-setup.ts",
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
    // Der Testserver spricht weder mit Stripe noch mit Resend, auch wenn .env echte
    // Schlüssel enthält: Webhook-Tests signieren Events selbst mit einem Test-Secret,
    // und Testadressen würde Resend ohnehin ablehnen.
    env: {
      STRIPE_SECRET_KEY: "",
      STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
      APP_URL: `http://localhost:${PORT}`,
      RESEND_API_KEY: "",
      CRON_SECRET: CRON_TEST_SECRET,
    },
  },
});
