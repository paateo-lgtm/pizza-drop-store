import { expect, test } from "@playwright/test";

test("Landingpage zeigt den nächsten Drop und berechnet die Abholzeit", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "17:00–20:00",
  );

  await page.getByRole("button", { name: "Margherita hinzufügen" }).click();
  await page.getByRole("button", { name: "Diavola hinzufügen" }).click();
  await expect(page.getByText("Freie Abholzeiten für 2 Pizzen")).toBeVisible();

  await page.getByRole("button", { name: "17:48" }).click();
  await expect(page.getByText("17:48 Uhr")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Weiter zur Zahlung" }),
  ).toBeEnabled();
});

test("Kitchen-Entwurf zeigt die Pizza im Ofen", async ({ page }) => {
  await page.goto("/entwurf/kueche");
  await expect(
    page.getByRole("heading", { name: "Jetzt im Ofen" }),
  ).toBeVisible();
  await expect(page.getByText("Diavola").first()).toBeVisible();
});
