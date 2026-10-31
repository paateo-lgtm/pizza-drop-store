/**
 * Beispieldaten für die lokale Entwicklung: Team, Zutaten, Pizzen, ein Drop mit Slots.
 * Ausführen mit `npm run db:seed`. Idempotent: vorhandene Daten werden aktualisiert.
 */
import "dotenv/config";
import { TZDate } from "@date-fns/tz";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { nextFriday, set, startOfDay, subDays } from "date-fns";
import { PrismaClient, Unit } from "../src/generated/prisma/client";
import { generateSlots } from "../src/lib/domain/slots";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const TZ = "Europe/Berlin";

const ingredients = [
  { name: "Teigling (250 g)", unit: Unit.PIECE },
  { name: "Tomaten San Marzano", unit: Unit.GRAM },
  { name: "Fior di Latte", unit: Unit.GRAM, allergen: "Milch" },
  { name: "Pecorino Toscano", unit: Unit.GRAM, allergen: "Milch" },
  { name: "Basilikum", unit: Unit.GRAM },
  { name: "Olivenöl extra vergine", unit: Unit.MILLILITER },
  { name: "Knoblauch", unit: Unit.GRAM },
  { name: "Oregano", unit: Unit.GRAM },
  { name: "Salame piccante", unit: Unit.GRAM },
  { name: "Finocchiona", unit: Unit.GRAM },
  { name: "Steinpilze", unit: Unit.GRAM },
  { name: "Rucola", unit: Unit.GRAM },
] as const;

type Recipe = Record<string, number>;

const pizzas: {
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  allergens: string[];
  tags: string[];
  recipe: Recipe;
}[] = [
  {
    slug: "margherita",
    name: "Margherita",
    description: "San-Marzano-Tomaten, Fior di Latte, Basilikum, Olivenöl.",
    priceCents: 1050,
    allergens: ["Gluten", "Milch"],
    tags: ["vegetarisch"],
    recipe: {
      "Teigling (250 g)": 1,
      "Tomaten San Marzano": 80,
      "Fior di Latte": 90,
      Basilikum: 2,
      "Olivenöl extra vergine": 8,
    },
  },
  {
    slug: "marinara",
    name: "Marinara",
    description: "Tomate, Knoblauch, Oregano, Olivenöl. Ohne Käse.",
    priceCents: 850,
    allergens: ["Gluten"],
    tags: ["vegan"],
    recipe: {
      "Teigling (250 g)": 1,
      "Tomaten San Marzano": 100,
      Knoblauch: 4,
      Oregano: 1,
      "Olivenöl extra vergine": 10,
    },
  },
  {
    slug: "diavola",
    name: "Diavola",
    description: "Tomate, Fior di Latte, scharfe Salame, Basilikum.",
    priceCents: 1250,
    allergens: ["Gluten", "Milch"],
    tags: ["scharf"],
    recipe: {
      "Teigling (250 g)": 1,
      "Tomaten San Marzano": 80,
      "Fior di Latte": 90,
      "Salame piccante": 45,
      Basilikum: 1,
    },
  },
  {
    slug: "toscana",
    name: "Toscana",
    description: "Fior di Latte, Finocchiona, Pecorino Toscano, Rucola.",
    priceCents: 1450,
    allergens: ["Gluten", "Milch"],
    tags: [],
    recipe: {
      "Teigling (250 g)": 1,
      "Fior di Latte": 80,
      Finocchiona: 50,
      "Pecorino Toscano": 20,
      Rucola: 15,
      "Olivenöl extra vergine": 6,
    },
  },
  {
    slug: "porcini",
    name: "Porcini",
    description: "Weiße Pizza mit Steinpilzen, Fior di Latte und Knoblauchöl.",
    priceCents: 1400,
    allergens: ["Gluten", "Milch"],
    tags: ["vegetarisch"],
    recipe: {
      "Teigling (250 g)": 1,
      "Fior di Latte": 90,
      Steinpilze: 70,
      Knoblauch: 3,
      "Olivenöl extra vergine": 8,
    },
  },
];

async function seedTeam() {
  const password = process.env.SEED_PASSWORD;
  if (!password) {
    throw new Error("SEED_PASSWORD fehlt in .env");
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const team = [
    { email: "admin@pizzadrop.test", name: "Admin", role: "ADMIN" as const },
    { email: "kueche@pizzadrop.test", name: "Küche", role: "KITCHEN" as const },
  ];
  for (const member of team) {
    await db.user.upsert({
      where: { email: member.email },
      update: { passwordHash, role: member.role },
      create: { ...member, passwordHash },
    });
  }
}

async function seedPizzas() {
  const ids = new Map<string, string>();
  for (const ingredient of ingredients) {
    const row = await db.ingredient.upsert({
      where: { name: ingredient.name },
      update: {},
      create: ingredient,
    });
    ids.set(row.name, row.id);
  }

  for (const [index, { recipe, ...pizza }] of pizzas.entries()) {
    const ingredientRows = Object.entries(recipe).map(([name, amount], i) => ({
      ingredientId: ids.get(name)!,
      amountPerPizza: amount,
      sortOrder: i,
    }));
    await db.pizza.upsert({
      where: { slug: pizza.slug },
      update: {
        ...pizza,
        sortOrder: index,
        ingredients: { deleteMany: {}, create: ingredientRows },
      },
      create: {
        ...pizza,
        sortOrder: index,
        ingredients: { create: ingredientRows },
      },
    });
  }
}

async function seedDrop() {
  // Nächster Freitag, Backen 17:00–20:00 Uhr Berliner Zeit, 6 Minuten pro Pizza.
  const friday = nextFriday(startOfDay(TZDate.tz(TZ)));
  const bakeStartsAt = set(friday, { hours: 17, minutes: 0 });
  const bakeEndsAt = set(friday, { hours: 20, minutes: 0 });
  const slotSeconds = 360;
  const slug = "drop-beispiel";

  const existing = await db.drop.findUnique({ where: { slug } });
  if (existing) {
    await db.drop.delete({ where: { id: existing.id } });
  }

  const allPizzas = await db.pizza.findMany({ orderBy: { sortOrder: "asc" } });
  await db.drop.create({
    data: {
      slug,
      title: "Freitags-Drop",
      status: "ON_SALE",
      saleStartsAt: subDays(friday, 3),
      saleEndsAt: set(friday, { hours: 16, minutes: 0 }),
      bakeStartsAt,
      bakeEndsAt,
      slotSeconds,
      maxPizzasPerOrder: 4,
      location: "Pizza Drop, Hinterhof",
      pizzas: {
        create: allPizzas.map((pizza, i) => ({
          pizzaId: pizza.id,
          sortOrder: i,
        })),
      },
      slots: {
        create: generateSlots(bakeStartsAt, bakeEndsAt, slotSeconds),
      },
    },
  });
}

async function seedSettings() {
  const settings = {
    defaultSlotSeconds: 360,
    vatRatePercent: 7,
    reservationMinutes: 10,
    shopName: "Pizza Drop",
  };
  for (const [key, value] of Object.entries(settings)) {
    await db.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}

async function main() {
  await seedTeam();
  await seedPizzas();
  await seedDrop();
  await seedSettings();
  const [pizzaCount, slotCount] = await Promise.all([
    db.pizza.count(),
    db.slot.count(),
  ]);
  console.log(`Seed fertig: ${pizzaCount} Pizzen, ${slotCount} Slots.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
