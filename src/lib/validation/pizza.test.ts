import { describe, expect, it } from "vitest";
import { centsToEuroInput, parseEuroToCents, slugify } from "./common";
import { pizzaFormToObject, pizzaSchema } from "./pizza";

describe("parseEuroToCents", () => {
  it.each([
    ["10,50", 1050],
    ["10.5", 1050],
    ["8", 800],
    [" 12,00 € ", 1200],
  ])("%s → %i Cent", (input, cents) => {
    expect(parseEuroToCents(input)).toBe(cents);
  });

  it.each(["", "abc", "-5", "10,505", "1.000,00"])("lehnt %j ab", (input) => {
    expect(parseEuroToCents(input)).toBeNull();
  });

  it("formatiert zurück fürs Formular", () => {
    expect(centsToEuroInput(1050)).toBe("10,50");
  });
});

describe("slugify", () => {
  it("macht URL-taugliche Namen", () => {
    expect(slugify("Funghi & Salsiccia")).toBe("funghi-salsiccia");
    expect(slugify("Käse Spezial")).toBe("kaese-spezial");
    expect(slugify("  Crème Brûlée ")).toBe("creme-brulee");
  });
});

function form(entries: [string, string][]) {
  const data = new FormData();
  for (const [k, v] of entries) data.append(k, v);
  return data;
}

describe("pizzaSchema", () => {
  const base: [string, string][] = [
    ["name", "Funghi"],
    ["description", "Tomate, Fior di Latte, Champignons."],
    ["price", "11,50"],
    ["allergens", "Gluten"],
    ["allergens", "Milch"],
    ["tags", "vegetarisch"],
    ["customTags", "Saison, vegetarisch"],
    ["active", "on"],
    ["recipe.0.ingredientId", "ing-1"],
    ["recipe.0.amount", "80"],
    ["recipe.1.ingredientId", "ing-2"],
    ["recipe.1.amount", "2,5"],
  ];

  it("liest ein vollständiges Formular", () => {
    const result = pizzaSchema.parse(pizzaFormToObject(form(base)));
    expect(result).toMatchObject({
      name: "Funghi",
      slug: "funghi",
      price: 1150,
      allergens: ["Gluten", "Milch"],
      tags: ["vegetarisch", "saison"],
      active: true,
      recipe: [
        { ingredientId: "ing-1", amount: 80 },
        { ingredientId: "ing-2", amount: 2.5 },
      ],
    });
  });

  it("behandelt fehlenden Schalter als inaktiv", () => {
    const result = pizzaSchema.parse(
      pizzaFormToObject(form(base.filter(([k]) => k !== "active"))),
    );
    expect(result.active).toBe(false);
  });

  it("meldet ungültige Preise, Allergene und doppelte Zutaten", () => {
    const result = pizzaSchema.safeParse(
      pizzaFormToObject(
        form([
          ...base.filter(([k]) => k !== "price"),
          ["price", "gratis"],
          ["allergens", "Ananas"],
          ["recipe.2.ingredientId", "ing-1"],
          ["recipe.2.amount", "10"],
        ]),
      ),
    );
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["price", "allergens"]));
  });

  it("erkennt doppelte Zutaten im Rezept", () => {
    const result = pizzaSchema.safeParse(
      pizzaFormToObject(
        form([
          ...base,
          ["recipe.2.ingredientId", "ing-1"],
          ["recipe.2.amount", "10"],
        ]),
      ),
    );
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].path).toEqual(["recipe"]);
  });
});
