"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  MAX_COMMENT_LENGTH,
  submitFeedback,
  withdrawFeedbackConsent,
} from "@/lib/marketing/feedback";

export type FeedbackFormState =
  { ok: true } | { ok: false; message: string } | null;

const input = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(MAX_COMMENT_LENGTH),
});

const MESSAGES = {
  done: "Für diese Bestellung haben wir schon eine Bewertung – danke!",
  closed: "Für diese Bestellung nehmen wir keine Bewertung mehr an.",
  invalid: "Dieser Link gilt nicht. Bitte öffne ihn noch einmal aus der Mail.",
} as const;

export async function sendFeedback(
  orderId: string,
  key: string,
  _prev: FeedbackFormState,
  formData: FormData,
): Promise<FeedbackFormState> {
  const parsed = input.safeParse({
    rating: formData.get("rating"),
    comment: String(formData.get("comment") ?? ""),
  });
  if (!parsed.success) {
    const tooLong = parsed.error.issues.some((i) => i.path[0] === "comment");
    return {
      ok: false,
      message: tooLong
        ? `Der Kommentar darf höchstens ${MAX_COMMENT_LENGTH} Zeichen haben.`
        : "Bitte wähle 1 bis 5 Sterne.",
    };
  }
  try {
    const result = await submitFeedback({ orderId, key, ...parsed.data });
    return result === "saved"
      ? { ok: true }
      : { ok: false, message: MESSAGES[result] };
  } catch (error) {
    console.error("Feedback konnte nicht gespeichert werden", error);
    return {
      ok: false,
      message: "Das hat gerade nicht geklappt. Bitte versuch es noch einmal.",
    };
  }
}

export async function withdrawConsent(orderId: string, key: string) {
  let result: string = "invalid";
  try {
    result = await withdrawFeedbackConsent(orderId, key);
  } catch (error) {
    console.error("Widerspruch gegen Feedback-Anfragen fehlgeschlagen", error);
    result = "error";
  }
  // Ohne Schlüssel in der Adresse weiter: das Ergebnis zeigt die Seite
  redirect(`/feedback/${orderId}/abmelden?status=${result}`);
}
