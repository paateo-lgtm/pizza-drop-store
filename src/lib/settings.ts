import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";

export const settingsSchema = z.object({
  shopName: z.string().trim().min(2).max(60),
  contactEmail: z.union([z.email(), z.literal("")]),
  pickupLocation: z.string().trim().max(120),
  /** Standard-Slotlänge = Zeit pro Pizza für neue Drops */
  defaultSlotSeconds: z.number().int().min(120).max(1200),
  defaultMaxPizzasPerOrder: z.number().int().min(1).max(20),
  reservationMinutes: z.number().int().min(5).max(30),
  vatRatePercent: z.number().min(0).max(25),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  shopName: "Pizza Drop",
  contactEmail: "",
  pickupLocation: "",
  defaultSlotSeconds: 360,
  defaultMaxPizzasPerOrder: 4,
  reservationMinutes: 10,
  vatRatePercent: 7,
};

/** Gespeicherte Werte über die Standardwerte legen; ungültige Einträge werden ignoriert. */
export async function getSettings(): Promise<Settings> {
  const rows = await db.setting.findMany();
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const merged = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const parsed = settingsSchema.shape[key].safeParse(stored[key]);
    if (parsed.success) {
      (merged as Record<string, unknown>)[key] = parsed.data;
    }
  }
  return merged;
}

export async function saveSettings(settings: Settings) {
  await db.$transaction(
    Object.entries(settings).map(([key, value]) =>
      db.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      }),
    ),
  );
}
