import type { Metadata } from "next";
import { KitchenPreview } from "./kitchen-preview";

export const metadata: Metadata = { title: "Küche (Entwurf)" };

// Design-Entwurf des Kitchen-Mode (Phase 0) mit Beispieldaten – echte Umsetzung in Phase 5.
export default function KitchenDraftPage() {
  return <KitchenPreview />;
}
