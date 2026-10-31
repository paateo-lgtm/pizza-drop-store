import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { effectiveStatus, isGridLocked } from "@/lib/domain/drops";
import { toBerlinLocalInput } from "@/lib/time";
import { centsToEuroInput } from "@/lib/validation/common";
import { PageHeader, PageSkeleton } from "../../../_components/page-header";
import { getPizzaOptions } from "../../data";
import { DropForm } from "../../drop-form";

export const metadata: Metadata = { title: "Drop bearbeiten" };

export default function EditDropPage(
  props: PageProps<"/admin/drops/[id]/bearbeiten">,
) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Drop bearbeiten" />
          <PageSkeleton rows={6} />
        </>
      }
    >
      <EditDrop params={props.params} />
    </Suspense>
  );
}

async function EditDrop({
  params,
}: Pick<PageProps<"/admin/drops/[id]/bearbeiten">, "params">) {
  await requireUser("drops:manage");
  const { id } = await params;
  const drop = await db.drop.findUnique({
    where: { id },
    include: { pizzas: { orderBy: { sortOrder: "asc" } } },
  });
  if (!drop) notFound();

  const status = effectiveStatus(drop, new Date());
  if (status === "COMPLETED" || status === "CANCELLED") {
    redirect(`/admin/drops/${drop.id}`);
  }
  const pizzas = await getPizzaOptions(drop.pizzas.map((p) => p.pizzaId));

  return (
    <>
      <PageHeader title={drop.title} description="Drop bearbeiten" />
      <DropForm
        gridLocked={isGridLocked(status)}
        slugLocked={drop.status !== "DRAFT"}
        pizzas={pizzas}
        initial={{
          id: drop.id,
          title: drop.title,
          slug: drop.slug,
          saleStartsAt: toBerlinLocalInput(drop.saleStartsAt),
          saleEndsAt: toBerlinLocalInput(drop.saleEndsAt),
          bakeStartsAt: toBerlinLocalInput(drop.bakeStartsAt),
          bakeEndsAt: toBerlinLocalInput(drop.bakeEndsAt),
          slotSeconds: drop.slotSeconds,
          maxPizzasTotal: drop.maxPizzasTotal?.toString() ?? "",
          maxPizzasPerOrder: String(drop.maxPizzasPerOrder),
          location: drop.location ?? "",
          notes: drop.notes ?? "",
          pizzas: drop.pizzas.map((p) => ({
            pizzaId: p.pizzaId,
            price:
              p.priceOverrideCents === null
                ? ""
                : centsToEuroInput(p.priceOverrideCents),
            maxQuantity: p.maxQuantity?.toString() ?? "",
          })),
        }}
      />
    </>
  );
}
