import { expect, test, type Page } from "@playwright/test";

// Test-Accounts aus prisma/seed.ts; das Passwort kommt aus SEED_PASSWORD (.env bzw. CI).
const password = process.env.SEED_PASSWORD ?? "";

async function login(page: Page, email: string, pw = password) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(pw);
  await page.getByRole("button", { name: "Anmelden" }).click();
}

test.describe("Team-Login", () => {
  test.skip(!password, "SEED_PASSWORD ist nicht gesetzt");

  test("schützt den Admin-Bereich und leitet nach dem Login zurück", async ({
    page,
  }) => {
    await page.goto("/admin/pizzen");
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Fpizzen/);

    await page.getByLabel("E-Mail").fill("admin@pizzadrop.test");
    await page.getByLabel("Passwort").fill(password);
    await page.getByRole("button", { name: "Anmelden" }).click();

    await expect(page).toHaveURL(/\/admin\/pizzen$/);
    await expect(
      page.getByRole("heading", { name: "Pizzen", level: 1 }),
    ).toBeVisible();
  });

  test("lehnt falsche Passwörter ab", async ({ page }) => {
    await login(page, "admin@pizzadrop.test", "falsches-passwort");
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "E-Mail oder Passwort ist falsch." }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("die Küche landet im Kitchen-Mode und kommt nicht in den Admin-Bereich", async ({
    page,
  }) => {
    await login(page, "kueche@pizzadrop.test");
    await expect(page).toHaveURL(/\/kitchen$/);
    await expect(page.getByText("Angemeldet als Küche")).toBeVisible();

    await page.goto("/admin/einstellungen");
    await expect(page).toHaveURL(/\/kitchen$/);
  });

  test("Abmelden beendet die Sitzung", async ({ page }) => {
    await login(page, "admin@pizzadrop.test");
    await expect(page).toHaveURL(/\/admin$/);
    await page.getByRole("button", { name: "Abmelden" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });
});
