import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { centsToEuroInput } from "@/lib/validation/common";
import { PageHeader, PageSkeleton } from "../../_components/page-header";
import { getIngredientOptions } from "../data";
import { DeletePizzaButton } from "../delete-pizza-button";
import { PizzaForm } from "../pizza-form";

export const metadata: Metadata = { title: "Pizza bearbeiten" };

export default function EditPizzaPage(props: PageProps<"/admin/pizzen/[id]">) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Pizza bearbeiten" />
          <PageSkeleton rows={6} />
        </>
      }
    >
      <EditPizza params={props.params} />
    </Suspense>
  );
}

async function EditPizza({
  params,
}: Pick<PageProps<"/admin/pizzen/[id]">, "params">) {
  await requireUser("pizzas:manage");
  const { id } = await params;
  const [pizza, ingredients] = await Promise.all([
    db.pizza.findUnique({
      where: { id },
      include: { ingredients: { orderBy: { sortOrder: "asc" } } },
    }),
    getIngredientOptions(),
  ]);
  if (!pizza) notFound();

  return (
    <>
      <PageHeader
        title={pizza.name}
        description="Pizza bearbeiten"
        action={<DeletePizzaButton pizzaId={pizza.id} name={pizza.name} />}
      />
      <PizzaForm
        ingredients={ingredients}
        initial={{
          id: pizza.id,
          name: pizza.name,
          slug: pizza.slug,
          description: pizza.description,
          price: centsToEuroInput(pizza.priceCents),
          imageUrl: pizza.imageUrl,
          allergens: pizza.allergens,
          tags: pizza.tags,
          active: pizza.active,
          recipe: pizza.ingredients.map((row) => ({
            ingredientId: row.ingredientId,
            amount: row.amountPerPizza.toString().replace(".", ","),
          })),
        }}
      />
    </>
  );
}
