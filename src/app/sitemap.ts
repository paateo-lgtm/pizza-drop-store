import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/payment/order-mails";

/** Startseite, kommende Drops und die festen Seiten. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = appUrl();
  const drops = await db.drop.findMany({
    where: {
      status: { notIn: ["DRAFT", "CANCELLED", "COMPLETED"] },
      bakeEndsAt: { gt: new Date() },
    },
    select: { slug: true, updatedAt: true },
  });
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    ...drops.map((d) => ({
      url: `${base}/drop/${d.slug}`,
      lastModified: d.updatedAt,
      changeFrequency: "hourly" as const,
      priority: 0.8,
    })),
    ...["impressum", "datenschutz", "agb", "allergene"].map((path) => ({
      url: `${base}/${path}`,
      changeFrequency: "monthly" as const,
      priority: 0.2,
    })),
  ];
}
