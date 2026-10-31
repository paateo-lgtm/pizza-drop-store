import { describe, expect, it } from "vitest";
import { reservationSchema } from "./booking";

const valid = {
  dropId: "drop1",
  startSeq: 3,
  items: [{ pizzaId: "marg", quantity: 2 }],
  name: "  Anna Rossi ",
  email: " Anna.Rossi@Example.DE ",
  phone: "0171 2345678",
  note: "",
  feedbackConsent: false,
};

const errorsOf = (input: unknown) => {
  const result = reservationSchema.safeParse(input);
  return result.success
    ? {}
    : Object.fromEntries(
        result.error.issues.map((i) => [i.path.join("."), i.message]),
      );
};

describe("reservationSchema", () => {
  it("normalisiert Name, E-Mail und leere Felder", () => {
    const result = reservationSchema.parse(valid);
    expect(result).toMatchObject({
      name: "Anna Rossi",
      email: "anna.rossi@example.de",
      phone: "0171 2345678",
      note: null,
      feedbackConsent: false,
    });
  });

  it("verlangt Name, gültige E-Mail und Telefonnummer", () => {
    expect(
      errorsOf({ ...valid, name: " ", email: "kein-at", phone: "" }),
    ).toEqual({
      name: "Bitte deinen Namen angeben.",
      email: "Bitte eine gültige E-Mail-Adresse angeben.",
      phone: "Bitte eine Telefonnummer für Rückfragen angeben.",
    });
  });

  it("akzeptiert übliche Schreibweisen von Telefonnummern", () => {
    for (const phone of ["+49 171 2345678", "(0171) 234-5678", "01712345678"]) {
      expect(errorsOf({ ...valid, phone })).toEqual({});
    }
    expect(errorsOf({ ...valid, phone: "abc" })).toHaveProperty("phone");
  });

  it("verlangt mindestens eine Pizza und ganze Mengen", () => {
    expect(errorsOf({ ...valid, items: [] })).toHaveProperty("items");
    expect(
      errorsOf({ ...valid, items: [{ pizzaId: "marg", quantity: 0 }] }),
    ).toHaveProperty(["items.0.quantity"]);
    expect(
      errorsOf({ ...valid, items: [{ pizzaId: "marg", quantity: 1.5 }] }),
    ).toHaveProperty(["items.0.quantity"]);
  });

  it("verlangt eine gewählte Abholzeit", () => {
    expect(errorsOf({ ...valid, startSeq: undefined })).toEqual({
      startSeq: "Bitte eine Abholzeit wählen.",
    });
  });

  it("begrenzt die Notiz", () => {
    expect(errorsOf({ ...valid, note: "x".repeat(301) })).toHaveProperty(
      "note",
    );
  });
});
