import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { PageHeader, PageSkeleton } from "../_components/page-header";
import { IngredientTable } from "./ingredient-table";

export const metadata: Metadata = { title: "Zutaten" };

export default function IngredientsPage() {
  return (
    <>
      <PageHeader
        title="Zutaten"
        description="Grundlage für Rezepte, Vorbereitungsliste und Allergenhinweise."
      />
      <Suspense fallback={<PageSkeleton />}>
        <Ingredients />
      </Suspense>
    </>
  );
}

async function Ingredients() {
  await requireUser("pizzas:manage");
  const ingredients = await db.ingredient.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      unit: true,
      allergen: true,
      _count: { select: { pizzas: true } },
    },
  });
  return (
    <IngredientTable
      ingredients={ingredients.map(({ _count, ...i }) => ({
        ...i,
        usedIn: _count.pizzas,
      }))}
    />
  );
}
