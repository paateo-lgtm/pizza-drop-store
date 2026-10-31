import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { PageHeader, PageSkeleton } from "../../_components/page-header";
import { getIngredientOptions } from "../data";
import { PizzaForm } from "../pizza-form";

export const metadata: Metadata = { title: "Neue Pizza" };

export default function NewPizzaPage() {
  return (
    <>
      <PageHeader title="Neue Pizza" />
      <Suspense fallback={<PageSkeleton rows={6} />}>
        <NewPizza />
      </Suspense>
    </>
  );
}

async function NewPizza() {
  await requireUser("pizzas:manage");
  const ingredients = await getIngredientOptions();
  return (
    <PizzaForm
      ingredients={ingredients}
      initial={{
        id: null,
        name: "",
        slug: "",
        description: "",
        price: "",
        imageUrl: null,
        allergens: ["Gluten"],
        tags: [],
        active: true,
        recipe: [{ ingredientId: "", amount: "" }],
      }}
    />
  );
}
