import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

/** Persönliche Links (Bestellung, Feedback, Alarm, Warteliste) und Team-Bereiche nicht indexieren. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/kitchen",
        "/login",
        "/api/",
        "/bestellung/",
        "/feedback/",
        "/alarm/",
        "/warteliste/",
      ],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
