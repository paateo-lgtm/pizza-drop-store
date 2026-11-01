import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { OrderMail } from "./order-mail";

// Resend rendert React-Mails selbst und lädt dafür `@react-email/render` von seinem
// eigenen Speicherort aus. Liegt das Paket nur verschachtelt unter
// `@react-email/components`, scheitert jede Mail mit „Failed to render React component“.
const fromResend = createRequire(
  createRequire(import.meta.url).resolve("resend"),
);

describe("Bestellmail", () => {
  it("ist für Resend renderbar", async () => {
    const { render } = (await import(
      /* @vite-ignore */ fromResend.resolve("@react-email/render")
    )) as typeof import("@react-email/render");

    const html = await render(
      <OrderMail
        preview="Bestellung bestätigt"
        heading="Bezahlt – wir backen für dich."
        intro="Danke für deine Bestellung."
        orderNumber={454}
        dropTitle="Freitags-Drop"
        pickup="Freitag, 6. November, 18:18 Uhr"
        location="Pizza Drop, Hinterhof"
        pickupCode="B5TQV9"
        items={[{ label: "2 × Margherita", price: "21,00 €" }]}
        total="21,00 €"
        link="https://pizza-drop-store.vercel.app/bestellung/x"
        linkLabel="Bestellung ansehen"
      />,
    );

    expect(html).toContain("B5TQV9");
    expect(html).toContain("2 × Margherita");
  });
});
