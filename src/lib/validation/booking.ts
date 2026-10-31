import { z } from "zod";

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .transform((v) => (v ? v : null));

/** Checkout-Daten; Preise und Namen der Pizzen bestimmt der Server, nicht das Formular. */
export const reservationSchema = z.object({
  dropId: z.string().min(1),
  startSeq: z
    .number({ error: "Bitte eine Abholzeit wählen." })
    .int("Bitte eine Abholzeit wählen.")
    .min(1, "Bitte eine Abholzeit wählen."),
  items: z
    .array(
      z.object({
        pizzaId: z.string().min(1),
        quantity: z
          .number({ error: "Bitte gültige Mengen wählen." })
          .int("Bitte gültige Mengen wählen.")
          .min(1, "Bitte gültige Mengen wählen.")
          .max(20, "Bitte gültige Mengen wählen."),
      }),
    )
    .min(1, "Bitte mindestens eine Pizza wählen.")
    .max(20),
  name: z
    .string()
    .trim()
    .min(2, "Bitte deinen Namen angeben.")
    .max(80, "Der Name ist zu lang."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Bitte eine gültige E-Mail-Adresse angeben.").max(254)),
  phone: z
    .string()
    .trim()
    .min(1, {
      error: "Bitte eine Telefonnummer für Rückfragen angeben.",
      abort: true,
    })
    .regex(
      /^\+?[\d\s()/-]{6,24}$/,
      "Bitte eine gültige Telefonnummer angeben.",
    ),
  note: optionalText(300, "Die Notiz darf höchstens 300 Zeichen haben."),
  feedbackConsent: z.boolean().default(false),
});

export type ReservationInput = z.infer<typeof reservationSchema>;
