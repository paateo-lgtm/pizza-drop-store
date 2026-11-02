import "server-only";
import { db } from "@/lib/db";

export type DropOption = { id: string; title: string; bakeStartsAt: Date };

/** Drops, die noch kommen oder laufen – dazu die bereits zugeordneten. */
export function getDropOptions(selected: string[] = []): Promise<DropOption[]> {
  return db.drop.findMany({
    where: {
      OR: [
        { status: { notIn: ["COMPLETED", "CANCELLED"] } },
        { id: { in: selected } },
      ],
    },
    orderBy: { bakeStartsAt: "desc" },
    select: { id: true, title: true, bakeStartsAt: true },
    take: 100,
  });
}
