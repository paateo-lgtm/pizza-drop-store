import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";

/** Nur die Küche ist als App installierbar; die Kundenseite bleibt eine Website. */
export const metadata: Metadata = {
  manifest: "/kueche.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Küche",
    statusBarStyle: "black-translucent",
  },
  icons: { apple: "/kueche-icon/192" },
};

export const viewport: Viewport = { themeColor: "#1c1a16" };

export default function KitchenLayout({ children }: LayoutProps<"/kitchen">) {
  return (
    <div className="kitchen flex min-h-dvh flex-col bg-background text-foreground">
      {children}
      <Toaster position="top-center" />
    </div>
  );
}
