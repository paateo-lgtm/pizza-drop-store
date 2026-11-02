"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { legalReady } from "@/lib/content/store";
import { sendConfirmMail } from "@/lib/marketing/alert-mails";
import {
  confirmMailsLastHour,
  confirmSubscription,
  subscribe,
  unsubscribe,
  type ConfirmMail,
} from "@/lib/marketing/drop-alert";

export type SignupState = { ok: boolean; message: string } | null;

const email = z.email().max(254);
const token = z.string().min(20).max(100);

/**
 * Höchstens so viele Bestätigungsmails pro Stunde, über alle Adressen: Das Formular soll
 * sich nicht nutzen lassen, um fremde Postfächer zu fluten. Pro-IP-Limit und Captcha
 * folgen in Phase 10.
 */
const CONFIRM_MAILS_PER_HOUR = 30;

const DONE =
  "Fast geschafft: Bitte bestätige den Link in der Mail, die wir dir gerade geschickt haben.";

/** Bestätigungsmail; ohne Resend-Schlüssel ist „übersprungen“ ein Fehler, kein Erfolg. */
async function sendConfirm(mail: ConfirmMail) {
  const result = await sendConfirmMail(mail);
  if (result === "skipped") {
    console.error(
      "Drop-Alarm: Bestätigungsmail nicht gesendet (RESEND_API_KEY fehlt)",
    );
  }
}

/**
 * Anmeldung zum Drop-Alarm. Die Antwort ist immer dieselbe – auch in der Dauer: Die
 * eigentliche Arbeit läuft nach der Antwort, damit sich bekannte Adressen nicht an
 * der Antwortzeit erkennen lassen. Fehler landen im Log.
 */
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
  // Ohne Impressum keine Anmeldung, auch nicht an der ausgeblendeten Seite vorbei.
  if (!(await legalReady())) {
    return { ok: false, message: "Die Anmeldung ist gerade nicht möglich." };
  }
  after(async () => {
    try {
      await subscribe(parsed.data, {
        sendConfirm,
        allowConfirm: async () =>
          (await confirmMailsLastHour(new Date())) < CONFIRM_MAILS_PER_HOUR,
      });
    } catch (error) {
      console.error("Anmeldung zum Drop-Alarm fehlgeschlagen", error);
    }
  });
  return { ok: true, message: DONE };
}

export async function confirmAlert(rawToken: string) {
  const parsed = token.safeParse(rawToken);
  let result: string = "invalid";
  try {
    if (parsed.success) result = await confirmSubscription(parsed.data);
  } catch (error) {
    console.error("Bestätigung des Drop-Alarms fehlgeschlagen", error);
    result = "error";
  }
  // Ohne Schlüssel in der Adresse weiter: das Ergebnis zeigt die Seite
  redirect(`/alarm/bestaetigen?status=${result}`);
}

export async function unsubscribeAlert(rawToken: string) {
  const parsed = token.safeParse(rawToken);
  let result: string = "invalid";
  try {
    if (parsed.success) result = await unsubscribe(parsed.data);
  } catch (error) {
    console.error("Abmeldung vom Drop-Alarm fehlgeschlagen", error);
    result = "error";
  }
  redirect(`/alarm/abmelden?status=${result}`);
}
