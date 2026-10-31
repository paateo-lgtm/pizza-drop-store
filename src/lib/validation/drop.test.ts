import { describe, expect, it } from "vitest";
import { dropFormToObject, dropSchema } from "./drop";

function form(overrides: Record<string, string> = {}, pizzas = defaultPizzas) {
  const data = new FormData();
  const fields: Record<string, string> = {
    title: "Freitags-Drop",
    slug: "",
    saleStartsAt: "2026-11-02T10:00",
    saleEndsAt: "2026-11-06T16:00",
    bakeStartsAt: "2026-11-06T17:00",
    bakeEndsAt: "2026-11-06T20:00",
    slotMinutes: "6",
    slotSecondsPart: "0",
    maxPizzasTotal: "",
    maxPizzasPerOrder: "4",
    location: "Hinterhof",
    notes: "",
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  pizzas.forEach((row, i) => {
    for (const [key, value] of Object.entries(row)) {
      data.set(`pizzas.${i}.${key}`, value);
    }
  });
  return data;
}

const defaultPizzas = [
  { pizzaId: "p1", price: "", maxQuantity: "" },
  { pizzaId: "p2", price: "12,50", maxQuantity: "10" },
];

const parse = (data: FormData) => dropSchema.safeParse(dropFormToObject(data));

describe("dropSchema", () => {
  it("liest ein vollständiges Formular in UTC und Sekunden", () => {
    const result = parse(form());
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      title: "Freitags-Drop",
      slug: "freitags-drop",
      saleStartsAt: new Date("2026-11-02T09:00:00Z"),
      bakeStartsAt: new Date("2026-11-06T16:00:00Z"),
      bakeEndsAt: new Date("2026-11-06T19:00:00Z"),
      slotSeconds: 360,
      maxPizzasTotal: null,
      maxPizzasPerOrder: 4,
      location: "Hinterhof",
      notes: null,
      pizzas: [
        { pizzaId: "p1", priceOverrideCents: null, maxQuantity: null },
        { pizzaId: "p2", priceOverrideCents: 1250, maxQuantity: 10 },
      ],
    });
  });

  it("setzt die Slotlänge aus Minuten und Sekunden zusammen", () => {
    const result = parse(form({ slotMinutes: "5", slotSecondsPart: "30" }));
    expect(result.data?.slotSeconds).toBe(330);
  });

  it("verlangt mindestens 2 Minuten pro Pizza", () => {
    const result = parse(form({ slotMinutes: "1", slotSecondsPart: "30" }));
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path[0])).toContain("slotMinutes");
  });

  it("meldet ein unlesbares Datum am Feld", () => {
    const result = parse(form({ bakeStartsAt: "morgen" }));
    expect(result.error?.issues.map((i) => i.path[0])).toContain(
      "bakeStartsAt",
    );
  });

  it("übernimmt die Zeitprüfung der Domäne", () => {
    const result = parse(form({ saleEndsAt: "2026-11-06T21:00" }));
    expect(result.error?.issues.map((i) => i.path[0])).toContain("saleEndsAt");
  });

  it("prüft die Obergrenze gegen die Slotanzahl", () => {
    // 17–20 Uhr bei 6 min = 30 Slots
    expect(parse(form({ maxPizzasTotal: "30" })).success).toBe(true);
    expect(
      parse(form({ maxPizzasTotal: "31" })).error?.issues.map((i) => i.path[0]),
    ).toContain("maxPizzasTotal");
  });

  it("verlangt mindestens eine Pizza", () => {
    const result = parse(form({}, []));
    expect(result.error?.issues.map((i) => i.path[0])).toContain("pizzas");
  });

  it("lehnt doppelte Pizzen ab", () => {
    const result = parse(
      form({}, [
        { pizzaId: "p1", price: "", maxQuantity: "" },
        { pizzaId: "p1", price: "", maxQuantity: "" },
      ]),
    );
    expect(result.error?.issues.map((i) => i.path[0])).toContain("pizzas");
  });

  it("lehnt ungültige Preise und Kontingente ab", () => {
    expect(
      parse(form({}, [{ pizzaId: "p1", price: "abc", maxQuantity: "" }]))
        .success,
    ).toBe(false);
    expect(
      parse(form({}, [{ pizzaId: "p1", price: "", maxQuantity: "0" }])).success,
    ).toBe(false);
  });

  it("meldet nicht-numerische Obergrenzen auf Deutsch", () => {
    const issue = parse(form({ maxPizzasTotal: "viele" })).error?.issues.find(
      (i) => i.path[0] === "maxPizzasTotal",
    );
    expect(issue?.message).toBe("Bitte eine ganze Zahl ab 1");
  });
});
