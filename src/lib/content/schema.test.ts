import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONTENT,
  faqSchema,
  isLegalComplete,
  landingSchema,
  legalSchema,
  parseContent,
} from "./schema";

const legal = {
  operatorName: "Anna Rossi",
  street: "Hauptstraße 1",
  postalCity: "12345 Musterstadt",
  email: "hallo@pizza-drop.test",
  phone: "",
  vatId: "",
  responsible: "",
};

describe("isLegalComplete", () => {
  it("verlangt Name, Anschrift und E-Mail; Telefon und USt-ID sind freiwillig", () => {
    expect(isLegalComplete(legal)).toBe(true);
    for (const key of ["operatorName", "street", "postalCity", "email"]) {
      expect(isLegalComplete({ ...legal, [key]: "  " })).toBe(false);
    }
  });

  it("ist ohne gespeicherte Angaben unvollständig", () => {
    expect(isLegalComplete(DEFAULT_CONTENT.legal)).toBe(false);
  });
});

describe("Schemas", () => {
  it("trimmt Eingaben und prüft die E-Mail", () => {
    expect(
      legalSchema.parse({ ...legal, operatorName: "  Anna Rossi " }),
    ).toMatchObject({ operatorName: "Anna Rossi" });
    expect(
      legalSchema.safeParse({ ...legal, email: "keine-mail" }).success,
    ).toBe(false);
  });

  it("nimmt FAQ nur mit Frage und Antwort an", () => {
    expect(
      faqSchema.safeParse([{ question: "Wie bezahle ich?", answer: "Online." }])
        .success,
    ).toBe(true);
    expect(
      faqSchema.safeParse([{ question: "Wie bezahle ich?", answer: " " }])
        .success,
    ).toBe(false);
  });

  it("hat für die Startseite genau drei Schritte", () => {
    const steps = DEFAULT_CONTENT.landing.steps;
    expect(steps).toHaveLength(3);
    expect(
      landingSchema.safeParse({
        ...DEFAULT_CONTENT.landing,
        steps: steps.slice(0, 2),
      }).success,
    ).toBe(false);
  });
});

describe("parseContent", () => {
  it("nutzt gespeicherte Werte und fällt bei fehlenden oder kaputten auf die Vorgabe zurück", () => {
    expect(parseContent("legal", legal)).toEqual(legal);
    expect(parseContent("legal", undefined)).toEqual(DEFAULT_CONTENT.legal);
    expect(parseContent("faq", "kaputt")).toEqual(DEFAULT_CONTENT.faq);
  });
});
