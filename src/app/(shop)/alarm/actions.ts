"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { sendConfirmMail } from "@/lib/marketing/alert-mails";
import {
  confirmSubscription,
  subscribe,
  unsubscribe,
} from "@/lib/marketing/drop-alert";

export type SignupState = { ok: boolean; message: string } | null;

const email = z.email().max(254);
const token = z.string().min(20).max(100);

/** Anmeldung zum Drop-Alarm. Die Antwort verrät nicht, ob die Adresse schon bekannt ist. */
export async function signUpForAlert(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  // Unsichtbares Feld: Bots füllen es aus, Menschen nicht. Kein Fehler, kein Versand.
  if (formData.get("website")) {
    return { ok: true, message: DONE };
  }
  const parsed = email.safeParse(String(formData.get("email") ?? "").trim());
  if (!parsed.success) {
    return { ok: false, message: "Bitte eine gültige E-Mail-Adresse angeben." };
  }
  try {
    await subscribe(parsed.data, { sendConfirm: sendConfirmMail });
  } catch (error) {
    console.error("Anmeldung zum Drop-Alarm fehlgeschlagen", error);
    return {
      ok: false,
      message:
        "Die Bestätigungsmail ließ sich gerade nicht senden. Bitte später noch einmal versuchen.",
    };
  }
  return { ok: true, message: DONE };
}

const DONE =
  "Fast geschafft: Bitte bestätige den Link in der Mail, die wir dir gerade geschickt haben.";

export async function confirmAlert(rawToken: string) {
  const parsed = token.safeParse(rawToken);
  const result = parsed.success
    ? await confirmSubscription(parsed.data)
    : "invalid";
  // Ohne Schlüssel in der Adresse weiter: das Ergebnis zeigt die Seite
  redirect(`/alarm/bestaetigen?status=${result}`);
}

export async function unsubscribeAlert(rawToken: string) {
  const parsed = token.safeParse(rawToken);
  const result = parsed.success ? await unsubscribe(parsed.data) : "invalid";
  redirect(`/alarm/abmelden?status=${result}`);
}
