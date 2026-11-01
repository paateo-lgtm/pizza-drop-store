import { expect, test } from "@playwright/test";

/** Kitchen-Mode als installierbare App (docs/PLAN.md, 1.4). */
test.describe("Küche als App", () => {
  test("das Küchen-Manifest startet in der Küche und hat PNG-Icons", async ({
    page,
    request,
  }) => {
    // Die Anmeldeseite der Küche ist ohne Login erreichbar und trägt das Manifest nicht;
    // das Manifest selbst muss ohne Anmeldung ladbar sein (Browser schicken keine Cookies).
    const response = await request.get("/kueche.webmanifest");
    expect(response.status()).toBe(200);
    const manifest = await response.json();
    expect(manifest).toMatchObject({
      name: "Pizza Drop · Küche",
      start_url: "/kitchen",
      scope: "/kitchen",
      display: "fullscreen",
    });

    for (const icon of manifest.icons as { src: string; sizes: string }[]) {
      const image = await request.get(icon.src);
      expect(image.status(), icon.src).toBe(200);
      expect(image.headers()["content-type"]).toBe("image/png");
    }
    expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual([
      "192x192",
      "512x512",
    ]);

    // Die Kundenseite bleibt ohne Küchen-Manifest
    await page.goto("/");
    await expect(page.locator('link[rel="manifest"]')).toHaveCount(0);
  });
});
