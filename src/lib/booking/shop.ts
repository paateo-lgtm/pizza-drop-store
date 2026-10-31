import "server-only";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { loadAvailability, type DropAvailability } from "./availability";

/** Veröffentlichte Drops, deren Backzeit noch nicht vorbei ist, nach Termin sortiert. */
export async function getUpcomingDrops(
  now: Date,
  limit = 4,
): Promise<DropAvailability[]> {
  const [drops, settings] = await Promise.all([
    db.drop.findMany({
      where: {
        status: { notIn: ["DRAFT", "CANCELLED", "COMPLETED"] },
        bakeEndsAt: { gt: now },
      },
      orderBy: { bakeStartsAt: "asc" },
      take: limit,
      select: { id: true },
    }),
    getSettings(),
  ]);
  const loaded = await Promise.all(
    drops.map((d) =>
      loadAvailability(db, { id: d.id }, now, settings.reservationMinutes),
    ),
  );
  return loaded.filter((d): d is DropAvailability => d !== null);
}

/** Öffentliche Drop-Seite; Entwürfe gibt es für Kunden nicht. */
export async function getShopDrop(
  slug: string,
  now: Date,
): Promise<DropAvailability | null> {
  const settings = await getSettings();
  const drop = await loadAvailability(
    db,
    { slug },
    now,
    settings.reservationMinutes,
  );
  return drop && drop.drop.status !== "DRAFT" ? drop : null;
}

/** Der Drop, der auf der Startseite oben steht: zuerst einer im Verkauf, sonst der nächste. */
export function featuredDrop(drops: DropAvailability[]) {
  return drops.find((d) => d.drop.status === "ON_SALE") ?? drops[0] ?? null;
}
