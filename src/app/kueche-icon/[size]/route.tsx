import { ImageResponse } from "next/og";

/** App-Icons der Küche (Manifest, Homescreen). Platzhalter bis zum echten Logo. */
const SIZES = ["192", "512"] as const;

export function generateStaticParams() {
  return SIZES.map((size) => ({ size }));
}

export async function GET(
  _request: Request,
  { params }: RouteContext<"/kueche-icon/[size]">,
) {
  const { size } = await params;
  if (!SIZES.includes(size as (typeof SIZES)[number])) {
    return new Response("Nicht gefunden", { status: 404 });
  }
  const px = Number(size);
  // Motiv mittig mit Rand, damit es auch als „maskable“ Icon nicht abgeschnitten wird.
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#1c1a16",
      }}
    >
      <div
        style={{
          width: px * 0.56,
          height: px * 0.56,
          borderRadius: "50%",
          background: "#b4553d",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#f7f2e8",
          fontSize: px * 0.24,
          fontWeight: 700,
        }}
      >
        PD
      </div>
    </div>,
    { width: px, height: px },
  );
}
