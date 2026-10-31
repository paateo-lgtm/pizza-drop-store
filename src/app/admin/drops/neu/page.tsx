import { TZDate } from "@date-fns/tz";
import { addHours, nextFriday, set, startOfDay, startOfHour } from "date-fns";
import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { getSettings } from "@/lib/settings";
import { TIME_ZONE, toBerlinLocalInput } from "@/lib/time";
import { PageHeader, PageSkeleton } from "../../_components/page-header";
import { getPizzaOptions } from "../data";
import { DropForm } from "../drop-form";

export const metadata: Metadata = { title: "Neuer Drop" };

export default function NewDropPage() {
  return (
    <>
      <PageHeader title="Neuer Drop" />
      <Suspense fallback={<PageSkeleton rows={6} />}>
        <NewDrop />
      </Suspense>
    </>
  );
}

async function NewDrop() {
  await requireUser("drops:manage");
  const [settings, pizzas] = await Promise.all([
    getSettings(),
    getPizzaOptions(),
  ]);

  // Vorschlag: nächster Freitag 17–20 Uhr, Verkauf ab der nächsten vollen Stunde bis 16 Uhr.
  const now = TZDate.tz(TIME_ZONE);
  const friday = nextFriday(startOfDay(now));
  const local = (date: Date) => toBerlinLocalInput(date);

  return (
    <DropForm
      gridLocked={false}
      pizzas={pizzas}
      initial={{
        id: null,
        title: "",
        slug: "",
        saleStartsAt: local(startOfHour(addHours(now, 1))),
        saleEndsAt: local(set(friday, { hours: 16, minutes: 0 })),
        bakeStartsAt: local(set(friday, { hours: 17, minutes: 0 })),
        bakeEndsAt: local(set(friday, { hours: 20, minutes: 0 })),
        slotSeconds: settings.defaultSlotSeconds,
        maxPizzasTotal: "",
        maxPizzasPerOrder: String(settings.defaultMaxPizzasPerOrder),
        location: settings.pickupLocation,
        notes: "",
        pizzas: pizzas.map((p) => ({
          pizzaId: p.id,
          price: "",
          maxQuantity: "",
        })),
      }}
    />
  );
}
