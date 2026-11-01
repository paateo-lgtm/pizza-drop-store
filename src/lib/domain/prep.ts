/**
 * Vorbereitungsliste: Teiglinge, Pizzen und Zutatenmengen pro Drop – für den aktuellen
 * Verkauf, hochgerechnet auf den Ausverkauf und mit Puffer. Reine Funktionen ohne
 * Framework- oder Datenbankbezug (siehe docs/PLAN.md, 1.5).
 */

export type Unit = "GRAM" | "MILLILITER" | "PIECE";

export type RecipeLine = {
  id: string;
  name: string;
  unit: Unit;
  /** Menge pro Pizza */
  amount: number;
};

export type PrepPizza = {
  id: string;
  name: string;
  /** Bereits verkauft in diesem Drop */
  sold: number;
  /** Kontingent dieser Sorte im Drop, null = unbegrenzt */
  maxQuantity: number | null;
  /** Verkauft in früheren Drops – Grundlage der Hochrechnung */
  pastSold: number;
  recipe: RecipeLine[];
};

/**
 * Wie viele Pizzen je Sorte bei Ausverkauf? Die freie Kapazität wird nach dem Verkauf
 * früherer Drops verteilt (neue Sorten ohne Historie zählen wie eine durchschnittliche),
 * ohne jede Historie nach dem aktuellen Verkauf, sonst gleichmäßig.
 * Kontingente deckeln; ihr Überschuss geht an die übrigen Sorten. Rest nach Reihenfolge.
 */
export function projectSellOut(
  menu: readonly PrepPizza[],
  capacity: number,
): Map<string, number> {
  const totalSold = menu.reduce((sum, p) => sum + p.sold, 0);
  const totalPast = menu.reduce((sum, p) => sum + p.pastSold, 0);
  const withHistory = menu.filter((p) => p.pastSold > 0).length;
  const weightOf = (p: PrepPizza) => {
    if (totalPast > 0) {
      // Anteile: neue Sorten je 1/n, die übrigen teilen den Rest nach ihrer Historie.
      return p.pastSold > 0
        ? (p.pastSold / totalPast) * (withHistory / menu.length)
        : 1 / menu.length;
    }
    return totalSold > 0 ? p.sold : 1;
  };

  const added = menu.map(() => 0);
  const headroom = menu.map((p) =>
    p.maxQuantity === null ? Infinity : Math.max(0, p.maxQuantity - p.sold),
  );
  const open = () =>
    menu.map((_, i) => i).filter((i) => headroom[i] > added[i]);
  let remaining = Math.max(0, capacity - totalSold);

  while (remaining > 0) {
    const candidates = open();
    if (candidates.length === 0) break;
    let weights = candidates.map((i) => weightOf(menu[i]));
    // Haben nur Sorten ohne Gewicht noch Platz, teilen sie sich den Rest gleichmäßig.
    if (weights.every((w) => w === 0)) weights = weights.map(() => 1);
    const total = weights.reduce((a, b) => a + b, 0);
    const shares = weights.map((w) => (remaining * w) / total);

    // Erst die Sorten füllen, deren Anteil ihr Kontingent sprengt, dann neu verteilen.
    const capped = candidates.filter(
      (i, k) => weights[k] > 0 && shares[k] >= headroom[i] - added[i],
    );
    if (capped.length > 0) {
      for (const i of capped) {
        remaining -= headroom[i] - added[i];
        added[i] = headroom[i];
      }
      continue;
    }

    const floors = shares.map(Math.floor);
    candidates.forEach((i, k) => (added[i] += floors[k]));
    let leftover = remaining - floors.reduce((a, b) => a + b, 0);
    const byFraction = candidates
      .map((i, k) => ({ i, fraction: shares[k] - floors[k] }))
      .filter(({ fraction }) => fraction > 0)
      .sort((a, b) => b.fraction - a.fraction);
    for (const { i } of byFraction) {
      if (leftover === 0) break;
      added[i] += 1;
      leftover -= 1;
    }
    remaining = 0;
  }

  return new Map(menu.map((p, i) => [p.id, p.sold + added[i]]));
}

export type PrepLine = { sold: number; sellOut: number; withBuffer: number };

/** Gleitkomma-Reste (600 × 1,1 = 660,0000001) nicht zur nächsten Einheit aufrunden. */
const roundUp = (value: number) => Math.ceil(Math.round(value * 100) / 100);
const tidy = (value: number) => Math.round(value * 100) / 100;

export function prepList(
  menu: readonly PrepPizza[],
  capacity: number,
  bufferPercent: number,
) {
  const sellOut = projectSellOut(menu, capacity);
  const factor = 1 + bufferPercent / 100;
  const line = (sold: number, projected: number): PrepLine => ({
    sold: tidy(sold),
    sellOut: tidy(projected),
    withBuffer: roundUp(projected * factor),
  });

  const pizzas = menu.map((p) => ({
    id: p.id,
    name: p.name,
    ...line(p.sold, sellOut.get(p.id) ?? p.sold),
  }));

  const sums = new Map<
    string,
    Omit<RecipeLine, "amount"> & { sold: number; projected: number }
  >();
  for (const p of menu) {
    const projected = sellOut.get(p.id) ?? p.sold;
    for (const { amount, ...ingredient } of p.recipe) {
      const sum = sums.get(ingredient.id) ?? {
        ...ingredient,
        sold: 0,
        projected: 0,
      };
      sum.sold += amount * p.sold;
      sum.projected += amount * projected;
      sums.set(ingredient.id, sum);
    }
  }
  const ingredients = [...sums.values()]
    .map(({ sold, projected, ...ingredient }) => ({
      ...ingredient,
      ...line(sold, projected),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));

  const totalSold = pizzas.reduce((sum, p) => sum + p.sold, 0);
  const totalSellOut = pizzas.reduce((sum, p) => sum + p.sellOut, 0);
  // Ein Teigling pro Pizza
  return { dough: line(totalSold, totalSellOut), pizzas, ingredients };
}

export type PrepList = ReturnType<typeof prepList>;
