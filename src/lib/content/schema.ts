/**
 * Pflegbare Inhalte (SiteContent): Betreiberangaben für Impressum und Rechtstexte,
 * Texte der Startseite und FAQ. Reine Schemas und Regeln, ohne Datenbank.
 */
import { z } from "zod";

export const legalSchema = z.any();
export const landingSchema = z.any();
export const faqSchema = z.any();

export type Legal = {
  operatorName: string;
  street: string;
  postalCity: string;
  email: string;
  phone: string;
  vatId: string;
  responsible: string;
};

export const DEFAULT_CONTENT = {} as {
  legal: Legal;
  landing: { steps: { title: string; text: string }[] };
  faq: { question: string; answer: string }[];
};

export function isLegalComplete(_legal: Legal): boolean {
  throw new Error("noch nicht umgesetzt");
}

export function parseContent(_key: string, _value: unknown): unknown {
  throw new Error("noch nicht umgesetzt");
}
