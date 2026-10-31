import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Bitte eine gültige E-Mail-Adresse eingeben"));

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Bitte das Passwort eingeben"),
});

// bcrypt berücksichtigt nur die ersten 72 Byte; längere Passwörter würden still gekürzt.
export const passwordSchema = z
  .string()
  .min(10, "Mindestens 10 Zeichen")
  .refine((value) => new TextEncoder().encode(value).length <= 72, {
    message: "Höchstens 72 Byte (bei Umlauten etwas weniger Zeichen)",
  });
