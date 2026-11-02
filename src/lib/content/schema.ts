/**
 * Pflegbare Inhalte (SiteContent): Betreiberangaben für Impressum und Rechtstexte,
 * Texte der Startseite und FAQ. Reine Schemas und Regeln, ohne Datenbank.
 */
import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);

export const legalSchema = z.object({
  operatorName: text(120),
  street: text(120),
  postalCity: text(120),
  email: z.union([z.email("Bitte eine gültige E-Mail-Adresse"), z.literal("")]),
  phone: text(40),
  vatId: text(30),
  /** Verantwortlich für den Inhalt (§ 18 Abs. 2 MStV), falls abweichend */
  responsible: text(120),
});

const step = z.object({
  title: text(60).min(1, "Bitte einen Titel"),
  text: text(240).min(1, "Bitte einen Text"),
});

export const landingSchema = z.object({
  noDropTitle: text(120).min(1, "Bitte eine Überschrift"),
  noDropText: text(400),
  alarmText: text(400),
  steps: z.array(step).length(3),
});

export const faqSchema = z
  .array(
    z.object({
      question: text(200).min(1, "Bitte eine Frage"),
      answer: text(2000).min(1, "Bitte eine Antwort"),
    }),
  )
  .max(30);

export type Legal = z.infer<typeof legalSchema>;
export type Landing = z.infer<typeof landingSchema>;
export type Faq = z.infer<typeof faqSchema>;

export const CONTENT_SCHEMAS = {
  legal: legalSchema,
  landing: landingSchema,
  faq: faqSchema,
};
export type ContentKey = keyof typeof CONTENT_SCHEMAS;
export type Content = { legal: Legal; landing: Landing; faq: Faq };

export const DEFAULT_CONTENT: Content = {
  legal: {
    operatorName: "",
    street: "",
    postalCity: "",
    email: "",
    phone: "",
    vatId: "",
    responsible: "",
  },
  landing: {
    noDropTitle: "Gerade ist kein Drop geplant.",
    noDropText:
      "Der Ofen ruht. Sobald der nächste Termin steht, findest du ihn hier – mit Karte und freien Abholzeiten.",
    alarmText:
      "Die Slots sind oft schnell weg. Mit dem Drop-Alarm weißt du als Erste:r, wenn der Verkauf startet.",
    steps: [
      {
        title: "Pizzen wählen",
        text: "Stell dir deine Bestellung aus der Karte des Drops zusammen.",
      },
      {
        title: "Abholzeit sichern",
        text: "Jede Pizza belegt einen Slot im Ofen. Du siehst sofort, wann alles fertig ist.",
      },
      {
        title: "Bezahlen & abholen",
        text: "Online bezahlen, zur Abholzeit vorbeikommen, Code zeigen, genießen.",
      },
    ],
  },
  faq: [],
};

/**
 * Ohne Name, Anschrift und E-Mail fehlt das Impressum (§ 5 DDG). Bis dahin bleiben
 * Formulare, die Adressen sammeln (Drop-Alarm, Warteliste), ausgeblendet.
 */
export function isLegalComplete(legal: Legal): boolean {
  return [
    legal.operatorName,
    legal.street,
    legal.postalCity,
    legal.email,
  ].every((v) => v.trim() !== "");
}

/** Gespeicherter Wert, wenn gültig; sonst die Vorgabe (wie bei den Einstellungen). */
export function parseContent<K extends ContentKey>(
  key: K,
  value: unknown,
): Content[K] {
  const parsed = CONTENT_SCHEMAS[key].safeParse(value);
  return parsed.success ? (parsed.data as Content[K]) : DEFAULT_CONTENT[key];
}
