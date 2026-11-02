import { describe, expect, it } from "vitest";
import { siteUrl } from "./site-url";

describe("siteUrl", () => {
  it("nimmt APP_URL ohne Schrägstrich am Ende", () => {
    expect(siteUrl({ APP_URL: "https://pizza.example/" })).toBe(
      "https://pizza.example",
    );
  });

  it("fällt auf die Produktions- bzw. Deployment-Adresse von Vercel zurück", () => {
    expect(
      siteUrl({
        VERCEL_PROJECT_PRODUCTION_URL: "pizza.vercel.app",
        VERCEL_URL: "pizza-abc.vercel.app",
      }),
    ).toBe("https://pizza.vercel.app");
    expect(siteUrl({ VERCEL_URL: "pizza-abc.vercel.app" })).toBe(
      "https://pizza-abc.vercel.app",
    );
  });

  it("wirft nie – ohne Angaben gilt localhost (z. B. im Build)", () => {
    expect(siteUrl({})).toBe("http://localhost:3000");
  });
});
