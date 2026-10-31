"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit, changedFields } from "@/lib/audit";
import { requireUser } from "@/lib/auth/dal";
import { getSettings, saveSettings, settingsSchema } from "@/lib/settings";
import { toFormState, type FormState } from "@/lib/validation/common";

const int = z.coerce.number().int();

const formSchema = z
  .object({
    shopName: z.string(),
    contactEmail: z.string().trim(),
    pickupLocation: z.string(),
    slotMinutes: int.min(0).max(20),
    slotSecondsPart: int.min(0).max(59),
    defaultMaxPizzasPerOrder: int,
    reservationMinutes: int,
    vatRatePercent: z.coerce.number(),
  })
  .transform(({ slotMinutes, slotSecondsPart, ...rest }) => ({
    ...rest,
    defaultSlotSeconds: slotMinutes * 60 + slotSecondsPart,
  }))
  .pipe(settingsSchema);

export async function updateSettings(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser("settings:manage");
  const parsed = formSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const state = toFormState(parsed.error);
    // Fehler der Slotlänge gehören zu den beiden Eingabefeldern
    if (state?.fieldErrors?.defaultSlotSeconds) {
      state.fieldErrors.slotMinutes = ["Zwischen 2:00 und 20:00 Minuten"];
    }
    return state;
  }

  const before = await getSettings();
  await saveSettings(parsed.data);
  await audit({
    userId: user.id,
    action: "update",
    entity: "settings",
    diff: changedFields(before, parsed.data),
  });
  revalidatePath("/");
  return { ok: true, message: "Einstellungen gespeichert" };
}
