import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/payment/order-mails";

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
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
