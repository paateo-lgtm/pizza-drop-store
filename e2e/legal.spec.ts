import { expect, test } from "@playwright/test";
import { createBookableDrop } from "./support/shop-data";

// Test-Account aus prisma/seed.ts; das Passwort kommt aus SEED_PASSWORD (.env bzw. CI).
const password = process.env.SEED_PASSWORD ?? "";

/** Rechtsseiten, SEO-Dateien, 404 und der Inhaltseditor. */
test.describe("Inhalte & Recht", () => {
  test("Impressum, Datenschutz und AGB zeigen die Betreiberangaben", async ({
    page,
  }) => {
    for (const path of ["/impressum", "/datenschutz", "/agb"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      // Das globale Setup sorgt für vollständige Angaben
      await expect(page.getByText("Die Angaben zum Betreiber")).toHaveCount(0);
    }
    await expect(page.getByRole("note")).toContainText("Entwurf");
    await page.goto("/");
    await page.getByRole("link", { name: "Impressum" }).click();
    await expect(page).toHaveURL(/\/impressum$/);
  });

  test("die Allergenübersicht listet die Pizzen der Karte", async ({
    page,
  }) => {
    await page.goto("/allergene");
    await expect(
      page.getByRole("heading", { name: "Allergene" }),
    ).toBeVisible();
    await expect(page.getByText("Margherita").first()).toBeVisible();
  });

  test("robots.txt sperrt persönliche Links, die Sitemap listet Drops", async ({
    request,
  }, testInfo) => {
    const robots = await (await request.get("/robots.txt")).text();
    for (const path of ["/admin", "/bestellung/", "/feedback/"]) {
      expect(robots).toContain(`Disallow: ${path}`);
    }
    const drop = await createBookableDrop(`sitemap-${testInfo.project.name}`);
    try {
      const sitemap = await (await request.get("/sitemap.xml")).text();
      expect(sitemap).toContain(`/drop/${drop.slug}`);
      expect(sitemap).toContain("/impressum");
    } finally {
      await drop.cleanup();
    }
  });

  test("unbekannte Seiten zeigen eine 404 mit Weg zurück", async ({ page }) => {
    const response = await page.goto("/gibt-es-nicht");
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { name: "Diese Seite gibt es nicht." }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Zu den Drops" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("Admin pflegt eine FAQ, die auf der Startseite erscheint", async ({
    page,
  }, testInfo) => {
    test.skip(!password, "SEED_PASSWORD ist nicht gesetzt");
    // Die FAQ ist global: nur ein Projekt ändert sie, sonst stören sich die Läufe.
    test.skip(testInfo.project.name !== "desktop", "nur auf Desktop");
    const question = `E2E-Frage ${Date.now()}`;

    await page.goto(`/login?next=${encodeURIComponent("/admin/inhalte")}`);
    await page.getByLabel("E-Mail").fill("admin@pizzadrop.test");
    await page.getByLabel("Passwort").fill(password);
    await page.getByRole("button", { name: "Anmelden" }).click();
    await expect(page).toHaveURL(/\/admin\/inhalte$/);
    await expect(page.getByRole("status").first()).toContainText(
      "Impressum vollständig",
    );

    const faq = page.locator("section", { hasText: "Häufige Fragen" });
    await faq.getByRole("button", { name: "Frage hinzufügen" }).click();
    const count = await faq
      .getByRole("textbox", { name: /^Frage \d+$/ })
      .count();
    await faq.getByRole("textbox", { name: `Frage ${count}` }).fill(question);
    await faq.getByRole("textbox", { name: `Antwort ${count}` }).fill("Ja.");
    await faq.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("FAQ gespeichert")).toBeVisible();

    await page.goto("/");
    await expect(page.getByText(question)).toBeVisible();

    // Aufräumen: die Frage wieder entfernen
    await page.goto("/admin/inhalte");
    await faq.getByRole("button", { name: `Frage ${count} entfernen` }).click();
    await faq.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("FAQ gespeichert")).toBeVisible();
  });
});
