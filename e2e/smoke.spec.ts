import { expect, test } from "@playwright/test";

test("Landingpage zeigt den nächsten Drop oder einen Leerzustand", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /\d{2}:\d{2}–\d{2}:\d{2}\s*Uhr|Gerade ist kein Drop geplant\./,
  );
  await expect(
    page.getByRole("heading", { name: "So funktioniert's" }),
  ).toBeVisible();
});
