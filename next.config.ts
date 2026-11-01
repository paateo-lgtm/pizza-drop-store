import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Kein Einbetten in fremde Seiten (Clickjacking-Schutz für Admin und Checkout)
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
        ],
      },
      {
        // Der Link-Schlüssel (?k=) soll nicht per Referer an andere Seiten gehen.
        source: "/bestellung/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
      {
        // Ebenso der Schlüssel in Bestätigungs- und Abmeldelinks des Drop-Alarms (?t=)
        source: "/alarm/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
      {
        // Und im Austragen-Link der Warteliste (?t=)
        source: "/warteliste/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
  partialPrefetching: true,
  experimental: {
    // Pizzabilder bis 3 MB per Server Action (Vercel erlaubt max. 4,5 MB pro Request)
    serverActions: { bodySizeLimit: "4mb" },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
