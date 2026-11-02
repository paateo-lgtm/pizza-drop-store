import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { LegalPage } from "@/components/legal-page";
import { ALLERGENS } from "@/lib/constants";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Allergene",
  description: "Welche der 14 Hauptallergene in unseren Pizzen stecken.",
};

export default function AllergensPage() {
  return (
    <LegalPage title="Allergene">
      <p>
        Die 14 Hauptallergene nach der Lebensmittel-Informationsverordnung
        (LMIV) für alle Pizzen auf unserer Karte. In unserer Küche werden alle
        Zutaten verarbeitet; Spuren anderer Allergene können wir nicht
        ausschließen.
      </p>
      <Suspense>
        <Table />
      </Suspense>
    </LegalPage>
  );
}

async function Table() {
  await connection();
  const pizzas = await db.pizza.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, allergens: true },
  });
  if (pizzas.length === 0) {
    return (
      <p className="text-ink-muted">Gerade steht keine Pizza auf der Karte.</p>
    );
  }
  return (
    <ul className="divide-y divide-line border-y border-line">
      {pizzas.map((pizza) => {
        const known = ALLERGENS.filter((a) => pizza.allergens.includes(a));
        return (
          <li key={pizza.id} className="!ml-0 !list-none py-3">
            <span className="font-medium">{pizza.name}</span>
            <span className="block text-ink-muted">
              {known.length > 0
                ? known.join(", ")
                : "keine der 14 Hauptallergene"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
