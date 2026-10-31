import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { PageHeader, PageSkeleton } from "../_components/page-header";
import { SavedToast } from "../_components/saved-toast";
import { PizzaList } from "./pizza-list";

export const metadata: Metadata = { title: "Pizzen" };

export default function PizzasPage(props: PageProps<"/admin/pizzen">) {
  return (
    <>
      <PageHeader
        title="Pizzen"
        description="Reihenfolge per Ziehen ändern. Inaktive Pizzen lassen sich keinem Drop zuordnen."
        action={
          <Button asChild>
            <Link href="/admin/pizzen/neu">
              <Plus /> Neue Pizza
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<PageSkeleton />}>
        <Pizzas />
        <SavedToast searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Pizzas() {
  await requireUser("pizzas:manage");
  const pizzas = await db.pizza.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      priceCents: true,
      imageUrl: true,
      active: true,
      tags: true,
      _count: { select: { ingredients: true } },
    },
  });
  return (
    <PizzaList
      pizzas={pizzas.map(({ _count, ...p }) => ({
        ...p,
        ingredientCount: _count.ingredients,
      }))}
    />
  );
}
