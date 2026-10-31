/** Die 14 kennzeichnungspflichtigen Hauptallergene (LMIV, Anhang II). */
export const ALLERGENS = [
  "Gluten",
  "Krebstiere",
  "Eier",
  "Fisch",
  "Erdnüsse",
  "Soja",
  "Milch",
  "Schalenfrüchte",
  "Sellerie",
  "Senf",
  "Sesam",
  "Sulfite",
  "Lupinen",
  "Weichtiere",
] as const;

export const SUGGESTED_TAGS = [
  "vegetarisch",
  "vegan",
  "scharf",
  "neu",
] as const;

export const UNIT_LABELS = {
  GRAM: "g",
  MILLILITER: "ml",
  PIECE: "Stück",
} as const;
