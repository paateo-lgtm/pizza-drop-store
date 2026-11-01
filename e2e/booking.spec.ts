import { expect, test, type Page } from "@playwright/test";
import { berlinTime, createBookableDrop, pool } from "./support/shop-data";

type TestDrop = Awaited<ReturnType<typeof createBookableDrop>>;

const SLOT = 360_000;

/** Die Abholzeiten sind Radios in einem Label; geklickt wird wie vom Nutzer aufs Label. */
const pickTime = (page: Page, name?: string) =>
  (name ? page.getByRole("radio", { name }) : page.getByRole("radio").first())
    .locator("..")
    .click();

async function fillDetails(page: Page, email: string) {
  await page.getByLabel("Name", { exact: true }).fill("Anna Rossi");
  await page.getByLabel("Telefon", { exact: true }).fill("0171 2345678");
  await page.getByLabel("E-Mail", { exact: true }).fill(email);
}

test.describe("Kundenbuchung", () => {
  let drop: TestDrop;

  test.beforeEach(async ({}, testInfo) => {
    drop = await createBookableDrop(testInfo.project.name);
  });

  test.afterEach(async () => {
    await drop.cleanup();
  });

  test.afterAll(async () => {
    await pool.end();
  });

  test("zwei Pizzen wählen, Abholzeit sichern und die Reservierung sehen", async ({
    page,
  }) => {
    await page.goto(`/drop/${drop.slug}`);
    await expect(
      page.getByRole("heading", { level: 1, name: /Testdrop/ }),
    ).toBeVisible();

    const more = page.getByRole("button", { name: "Eine Margherita mehr" });
    await more.click();
    await more.click();
    await expect(
      page.getByText("Freie Abholzeiten für 2 Pizzen"),
    ).toBeVisible();

    // Erste Abholzeit: zwei Slots ab Backbeginn → fertig nach 12 Minuten
    const pickup = berlinTime(new Date(drop.bakeStartsAt.getTime() + 2 * SLOT));
    await pickTime(page, pickup);
    await expect(
      page.locator("aside").getByText(`${pickup} Uhr`),
    ).toBeVisible();

    await fillDetails(page, `${drop.emailPrefix}-a@pizzadrop.test`);
    await page.getByRole("button", { name: "Abholzeit reservieren" }).click();

    await expect(page).toHaveURL(/\/bestellung\/[^/?]+\?k=/);
    await expect(
      page.getByRole("heading", { name: "Deine Abholzeit ist reserviert." }),
    ).toBeVisible();
    // Die vorherige Seite bleibt versteckt im DOM (Rücknavigation); deshalb im Artikel suchen.
    const order = page.getByRole("article");
    await expect(order.getByText("2 × Margherita")).toBeVisible();
    // Erfolg darf keine Fehlermeldung auslösen (früher: Weiterleitung als Fehler gewertet)
    await expect(page.getByText("Das hat nicht geklappt")).toHaveCount(0);
    await expect(order.getByText(`${pickup} Uhr`)).toBeVisible();

    const [stored] = await drop.orders();
    expect(stored).toEqual({
      status: "PENDING_PAYMENT",
      totalCents: 2100,
      seqs: [1, 2],
    });
  });

  test("wer zu spät kommt, bekommt einen Hinweis und eine neue Auswahl", async ({
    page,
    browser,
  }) => {
    const pickup = berlinTime(new Date(drop.bakeStartsAt.getTime() + SLOT));
    const other = await (await browser.newContext()).newPage();

    for (const p of [page, other]) {
      await p.goto(`/drop/${drop.slug}`);
      await p.getByRole("button", { name: "Eine Margherita mehr" }).click();
      await pickTime(p, pickup);
    }

    await fillDetails(other, `${drop.emailPrefix}-b@pizzadrop.test`);
    await other.getByRole("button", { name: "Abholzeit reservieren" }).click();
    await expect(other).toHaveURL(/\/bestellung\//);

    await fillDetails(page, `${drop.emailPrefix}-c@pizzadrop.test`);
    await page.getByRole("button", { name: "Abholzeit reservieren" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "vergeben" }),
    ).toHaveText(
      "Diese Abholzeit ist gerade vergeben worden. Bitte wähle eine andere.",
    );
    // Der Fokus landet auf der Meldung, nicht auf <body>
    await expect(
      page.getByRole("alert").filter({ hasText: "vergeben" }),
    ).toBeFocused();
    // Die vergebene Zeit ist verschwunden, die nächste ist wählbar
    await expect(page.getByRole("radio", { name: pickup })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Abholzeit reservieren" }),
    ).toBeDisabled();
    await other.context().close();
  });

  test("fehlende Angaben werden am Feld gemeldet", async ({ page }) => {
    await page.goto(`/drop/${drop.slug}`);
    await page.getByRole("button", { name: "Eine Margherita mehr" }).click();
    await pickTime(page);
    await page.getByLabel("Name", { exact: true }).fill("Anna Rossi");
    await page.getByLabel("E-Mail", { exact: true }).fill("keine-adresse");
    await page.getByRole("button", { name: "Abholzeit reservieren" }).click();

    await expect(
      page.getByText("Bitte eine Telefonnummer für Rückfragen angeben."),
    ).toBeVisible();
    await expect(
      page.getByText("Bitte eine gültige E-Mail-Adresse angeben."),
    ).toBeVisible();
    expect(await drop.orders()).toEqual([]);
  });

  test("eine Bestellung ist ohne gültigen Link-Schlüssel nicht abrufbar", async ({
    page,
  }) => {
    await page.goto(`/drop/${drop.slug}`);
    await page.getByRole("button", { name: "Eine Margherita mehr" }).click();
    await pickTime(page);
    await fillDetails(page, `${drop.emailPrefix}-d@pizzadrop.test`);
    await page.getByRole("button", { name: "Abholzeit reservieren" }).click();
    await expect(page).toHaveURL(/\/bestellung\//);

    const url = new URL(page.url());
    await page.goto(`${url.pathname}?k=falsch`);
    await expect(page.getByText("This page could not be found.")).toBeVisible();
    await expect(page.getByText("Margherita")).toHaveCount(0);
  });
});
