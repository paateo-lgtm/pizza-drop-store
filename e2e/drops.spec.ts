import { expect, test, type Page } from "@playwright/test";

// Test-Account aus prisma/seed.ts; das Passwort kommt aus SEED_PASSWORD (.env bzw. CI).
const password = process.env.SEED_PASSWORD ?? "";

async function loginAsAdmin(page: Page, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("E-Mail").fill("admin@pizzadrop.test");
  await page.getByLabel("Passwort").fill(password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(new RegExp(`${next}$`));
}

async function deleteCurrentDrop(page: Page) {
  await page.getByRole("button", { name: "Drop löschen" }).click();
  await page.getByRole("button", { name: "Endgültig löschen" }).click();
  await expect(page).toHaveURL(/\/admin\/drops$/);
}

test.describe("Drop-Verwaltung", () => {
  test.skip(!password, "SEED_PASSWORD ist nicht gesetzt");

  test("Drop anlegen, Puffer sperren, duplizieren und löschen", async ({
    page,
  }, testInfo) => {
    const title = `E2E ${testInfo.project.name} ${Date.now()}`;
    await loginAsAdmin(page, "/admin/drops/neu");

    await page.getByLabel("Titel", { exact: true }).fill(title);
    // Vorschlag: Freitag 17–20 Uhr; 6 min pro Pizza → 30 Slots
    await page.getByLabel("Zeit pro Pizza (Slotlänge)").fill("6");
    await page.getByLabel("Sekunden").selectOption("0");
    const preview = page.locator("aside").filter({ hasText: "Vorschau" });
    await expect(preview).toContainText("17:00–20:00 bei 6:00 min");
    await expect(preview.getByText("Slots").locator("+ dd")).toHaveText("30");

    // Obergrenze über der Slotanzahl wird abgelehnt
    await page.getByLabel("Obergrenze Pizzen (optional)").fill("31");
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("Höchstens 30")).toBeVisible();
    await page.getByLabel("Obergrenze Pizzen (optional)").fill("");

    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByText("Entwurf", { exact: true })).toBeVisible();

    const grid = page.getByRole("list", { name: "Legende" });
    await expect(grid).toContainText("frei 30");

    // Die Anzeige springt optimistisch um; erst nach der Server-Antwort neu laden.
    const saved = page.waitForResponse(
      (r) => r.request().method() === "POST" && r.ok(),
    );
    await page
      .getByRole("button", { name: /^Slot 1, 17:00–17:06, frei – sperren$/ })
      .click();
    await expect(grid).toContainText("gesperrt 1");
    await saved;
    await page.reload();
    await expect(
      page.getByRole("button", { name: /^Slot 1, .*gesperrt – freigeben$/ }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Veröffentlichen" }).click();
    await expect(page.getByText("Geplant", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Zurück zu Entwurf" }).click();
    await expect(page.getByText("Entwurf", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Duplizieren" }).click();
    await expect(
      page.getByRole("heading", { name: `${title} (Kopie)` }),
    ).toBeVisible();
    // Die Kopie startet ohne Sperren
    await expect(page.getByRole("list", { name: "Legende" })).toContainText(
      "gesperrt 0",
    );
    await deleteCurrentDrop(page);

    await page
      .getByRole("link", { name: new RegExp(`^${title}`) })
      .first()
      .click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await deleteCurrentDrop(page);
    await expect(
      page.getByRole("link", { name: new RegExp(title) }),
    ).toHaveCount(0);
  });
});
