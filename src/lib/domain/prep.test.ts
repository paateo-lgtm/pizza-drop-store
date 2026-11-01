import { describe, expect, it } from "vitest";
import { prepList, projectSellOut, type PrepPizza } from "./prep";

const pizza = (
  id: string,
  sold: number,
  extra: Partial<PrepPizza> = {},
): PrepPizza => ({
  id,
  name: id,
  sold,
  maxQuantity: null,
  pastSold: 0,
  recipe: [],
  ...extra,
});

const counts = (menu: PrepPizza[], capacity: number) =>
  Object.fromEntries(projectSellOut(menu, capacity));

describe("projectSellOut", () => {
  it("verteilt die freie Kapazität nach dem Verkauf früherer Drops", () => {
    const menu = [
      pizza("margherita", 2, { pastSold: 60 }),
      pizza("marinara", 0, { pastSold: 20 }),
      pizza("funghi", 0, { pastSold: 20 }),
    ];
    // 12 Pizzen Kapazität, 2 verkauft → 10 frei: 6 / 2 / 2
    expect(counts(menu, 12)).toEqual({ margherita: 8, marinara: 2, funghi: 2 });
  });

  it("rechnet eine neue Sorte ohne Historie wie eine durchschnittliche Sorte", () => {
    const menu = [
      pizza("margherita", 0, { pastSold: 30 }),
      pizza("marinara", 0, { pastSold: 10 }),
      pizza("neu", 0),
    ];
    // Neu bekommt 1/3; die anderen teilen 2/3 im Verhältnis 3 : 1
    expect(counts(menu, 12)).toEqual({ margherita: 6, marinara: 2, neu: 4 });
  });

  it("nimmt ohne frühere Drops den aktuellen Verkauf als Verteilung", () => {
    const menu = [pizza("margherita", 3), pizza("marinara", 1)];
    expect(counts(menu, 8)).toEqual({ margherita: 6, marinara: 2 });
  });

  it("verteilt ohne jeden Verkauf gleichmäßig, der Rest nach Reihenfolge", () => {
    const menu = [pizza("a", 0), pizza("b", 0), pizza("c", 0)];
    expect(counts(menu, 10)).toEqual({ a: 4, b: 3, c: 3 });
  });

  it("hält Kontingente ein und gibt den Überschuss an die anderen Sorten", () => {
    const menu = [
      pizza("tartufo", 1, { maxQuantity: 3, pastSold: 90 }),
      pizza("margherita", 0, { pastSold: 10 }),
    ];
    expect(counts(menu, 10)).toEqual({ tartufo: 3, margherita: 7 });
  });

  it("lässt Kapazität frei, wenn alle Kontingente erschöpft sind", () => {
    const menu = [
      pizza("a", 1, { maxQuantity: 2 }),
      pizza("b", 0, { maxQuantity: 1 }),
    ];
    expect(counts(menu, 10)).toEqual({ a: 2, b: 1 });
  });

  it("rechnet nie unter den aktuellen Verkauf, auch wenn die Kapazität erreicht ist", () => {
    const menu = [pizza("a", 4), pizza("b", 2)];
    expect(counts(menu, 5)).toEqual({ a: 4, b: 2 });
  });
});

describe("prepList", () => {
  const dough = { id: "teig", name: "Teigling", unit: "PIECE" as const };
  const tomato = { id: "tomate", name: "Tomaten", unit: "GRAM" as const };
  const cheese = { id: "fior", name: "Fior di Latte", unit: "GRAM" as const };

  const menu = [
    pizza("margherita", 3, {
      pastSold: 3,
      recipe: [
        { ...tomato, amount: 80 },
        { ...cheese, amount: 100 },
      ],
    }),
    pizza("marinara", 1, {
      pastSold: 1,
      recipe: [{ ...tomato, amount: 100.5 }],
    }),
  ];

  it("rechnet Teiglinge, Pizzen und Zutaten für verkauft, Ausverkauf und Puffer", () => {
    const list = prepList(menu, 8, 10);
    expect(list.dough).toEqual({ sold: 4, sellOut: 8, withBuffer: 9 });
    expect(list.pizzas).toEqual([
      {
        id: "margherita",
        name: "margherita",
        sold: 3,
        sellOut: 6,
        withBuffer: 7,
      },
      { id: "marinara", name: "marinara", sold: 1, sellOut: 2, withBuffer: 3 },
    ]);
    expect(list.ingredients).toEqual([
      // nach Name sortiert; Mengen mit Puffer aufgerundet
      { ...cheese, sold: 300, sellOut: 600, withBuffer: 660 },
      { ...tomato, sold: 340.5, sellOut: 681, withBuffer: 750 },
    ]);
  });

  it("führt einen Teigling aus dem Rezept als Zutat und die Teiglinge pro Pizza getrennt", () => {
    const withDough = [pizza("a", 2, { recipe: [{ ...dough, amount: 1 }] })];
    const list = prepList(withDough, 2, 0);
    expect(list.ingredients).toEqual([
      { ...dough, sold: 2, sellOut: 2, withBuffer: 2 },
    ]);
    expect(list.dough).toEqual({ sold: 2, sellOut: 2, withBuffer: 2 });
  });

  it("ohne Puffer entspricht „mit Puffer“ dem Ausverkauf", () => {
    const list = prepList(menu, 8, 0);
    expect(list.dough.withBuffer).toBe(8);
    expect(list.pizzas.map((p) => p.withBuffer)).toEqual([6, 2]);
  });
});
