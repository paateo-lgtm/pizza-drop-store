"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { joinWaitlist, leaveWaitlist } from "@/lib/marketing/waitlist";

export type WaitlistState = { ok: boolean; message: string } | null;

const input = z.object({
  dropId: z.string().min(1).max(100),
  email: z.email().max(254),
  quantity: z.coerce.number().int(),
});
const token = z.string().min(20).max(100);

const DONE =
  "Du stehst auf der Warteliste. Werden genug Slots am Stück frei, schreiben wir dir einmal – wer dann zuerst bucht, bekommt sie.";

/**
 * Eintragen auf die Warteliste. Die Antwort ist gleich, ob die Adresse schon eingetragen
 * war oder nicht. Pro-IP-Limit und Captcha folgen in Phase 10.
 */
export async function joinWaitlistAction(
  _prev: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  // Unsichtbares Feld: Bots füllen es aus, Menschen nicht.
  if (formData.get("website")) return { ok: true, message: DONE };
  const parsed = input.safeParse({
    dropId: formData.get("dropId"),
    email: String(formData.get("email") ?? "").trim(),
    quantity: formData.get("quantity"),
  });
  if (!parsed.success) {
    return { ok: false, message: "Bitte eine gültige E-Mail-Adresse angeben." };
  }
  try {
    const result = await joinWaitlist(parsed.data);
    if (result === "closed") {
      return { ok: false, message: "Für diesen Drop läuft kein Verkauf mehr." };
    }
    if (result === "available") {
      return {
        ok: false,
        message:
          "Gerade sind wieder Slots frei – lade die Seite neu und buche direkt.",
      };
    }
    if (result === "invalid") {
      return { ok: false, message: "Bitte eine gültige Anzahl wählen." };
    }
    return { ok: true, message: DONE };
  } catch (error) {
    console.error("Eintrag auf die Warteliste fehlgeschlagen", error);
    return {
      ok: false,
      message: "Das hat gerade nicht geklappt. Bitte versuch es noch einmal.",
    };
  }
}

export async function leaveWaitlistAction(rawToken: string) {
  const parsed = token.safeParse(rawToken);
  let result: string = "invalid";
  try {
    if (parsed.success) result = await leaveWaitlist(parsed.data);
  } catch (error) {
    console.error("Austragen von der Warteliste fehlgeschlagen", error);
    result = "error";
  }
  // Ohne Schlüssel in der Adresse weiter: das Ergebnis zeigt die Seite
  redirect(`/warteliste/austragen?status=${result}`);
}
