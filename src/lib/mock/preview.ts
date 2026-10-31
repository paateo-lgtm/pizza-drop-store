/**
 * Statische Beispieldaten für den Design-Entwurf (Phase 0).
 * Wird ab Phase 3 durch echte Daten aus der Datenbank ersetzt.
 */
import { generateSlots } from "@/lib/domain/slots";

export type PreviewPizza = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  tags: string[];
  allergens: string[];
  soldOut?: boolean;
};

export type PreviewSlotState = "free" | "taken" | "blocked";

export const previewDrop = {
  title: "Freitags-Drop",
  bakeStartsAt: new Date("2026-11-06T16:00:00Z"),
  bakeEndsAt: new Date("2026-11-06T19:00:00Z"),
  slotSeconds: 360,
  location: "Hinterhof, Via-Toscana-Straße 12",
  maxPizzasPerOrder: 4,
};

export const previewPizzas: PreviewPizza[] = [
  {
    id: "margherita",
    name: "Margherita",
    description: "San-Marzano-Tomaten, Fior di Latte, Basilikum, Olivenöl.",
    priceCents: 1050,
    tags: ["vegetarisch"],
    allergens: ["Gluten", "Milch"],
  },
  {
    id: "marinara",
    name: "Marinara",
    description: "Tomate, Knoblauch, Oregano, Olivenöl. Ohne Käse.",
    priceCents: 850,
    tags: ["vegan"],
    allergens: ["Gluten"],
  },
  {
    id: "diavola",
    name: "Diavola",
    description: "Tomate, Fior di Latte, scharfe Salame, Basilikum.",
    priceCents: 1250,
    tags: ["scharf"],
    allergens: ["Gluten", "Milch"],
  },
  {
    id: "toscana",
    name: "Toscana",
    description: "Fior di Latte, Finocchiona, Pecorino Toscano, Rucola.",
    priceCents: 1450,
    tags: [],
    allergens: ["Gluten", "Milch"],
  },
  {
    id: "porcini",
    name: "Porcini",
    description: "Weiße Pizza mit Steinpilzen, Fior di Latte und Knoblauchöl.",
    priceCents: 1400,
    tags: ["vegetarisch"],
    allergens: ["Gluten", "Milch"],
    soldOut: true,
  },
];

const taken = new Set([0, 1, 2, 4, 5, 8, 9, 10, 14, 15, 20, 21, 22, 23, 27]);
const blocked = new Set([12]);

export const previewSlots = generateSlots(
  previewDrop.bakeStartsAt,
  previewDrop.bakeEndsAt,
  previewDrop.slotSeconds,
).map((slot, i) => ({
  ...slot,
  state: (blocked.has(i)
    ? "blocked"
    : taken.has(i)
      ? "taken"
      : "free") as PreviewSlotState,
}));

export type PreviewTicket = {
  slotIndex: number;
  orderNumber: number;
  customer: string;
  pizza: string;
  position: number;
  of: number;
};

/** Küchen-Queue zum Zeitpunkt 17:24 Uhr: Slot 4 (17:24–17:30) ist dran. */
export const previewKitchen = {
  now: new Date("2026-11-06T16:25:20Z"),
  current: {
    slotIndex: 4,
    orderNumber: 1043,
    customer: "Giulia R.",
    pizza: "Diavola",
    position: 1,
    of: 2,
    ovenStartedAt: new Date("2026-11-06T16:24:40Z"),
  },
  queue: [
    {
      slotIndex: 5,
      orderNumber: 1043,
      customer: "Giulia R.",
      pizza: "Toscana",
      position: 2,
      of: 2,
    },
    {
      slotIndex: 8,
      orderNumber: 1044,
      customer: "Marco B.",
      pizza: "Margherita",
      position: 1,
      of: 3,
    },
    {
      slotIndex: 9,
      orderNumber: 1044,
      customer: "Marco B.",
      pizza: "Margherita",
      position: 2,
      of: 3,
    },
    {
      slotIndex: 10,
      orderNumber: 1044,
      customer: "Marco B.",
      pizza: "Marinara",
      position: 3,
      of: 3,
    },
    {
      slotIndex: 14,
      orderNumber: 1045,
      customer: "Lena K.",
      pizza: "Porcini",
      position: 1,
      of: 2,
    },
    {
      slotIndex: 15,
      orderNumber: 1045,
      customer: "Lena K.",
      pizza: "Diavola",
      position: 2,
      of: 2,
    },
  ] satisfies PreviewTicket[],
  ready: [
    {
      orderNumber: 1041,
      customer: "Sofia M.",
      pizzas: "Margherita, Marinara",
      pickupAt: new Date("2026-11-06T16:12:00Z"),
    },
    {
      orderNumber: 1042,
      customer: "Tom W.",
      pizzas: "Toscana",
      pickupAt: new Date("2026-11-06T16:18:00Z"),
    },
  ],
  doneSlots: 4,
  delaySeconds: 80,
  averageSeconds: 342,
};
