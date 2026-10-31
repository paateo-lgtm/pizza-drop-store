"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { homePathFor } from "@/lib/auth/permissions";
import { createSession, deleteSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { loginSchema } from "@/lib/validation/auth";

export type LoginState = { error?: string; email?: string } | undefined;

// Vergleich auch bei unbekannter E-Mail, damit die Antwortzeit nichts verrät.
const DUMMY_HASH = bcrypt.hashSync("kein-nutzer", 12);

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) {
    return { error: "Bitte E-Mail und Passwort eingeben.", email };
  }

  const user = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: {
      id: true,
      role: true,
      active: true,
      passwordHash: true,
      sessionVersion: true,
    },
  });
  const valid = await bcrypt.compare(
    parsed.data.password,
    user?.passwordHash ?? DUMMY_HASH,
  );
  if (!user || !valid || !user.active) {
    return { error: "E-Mail oder Passwort ist falsch.", email };
  }

  await createSession({
    userId: user.id,
    role: user.role,
    version: user.sessionVersion,
  });

  const next = String(formData.get("next") ?? "");
  // Nur interne Pfade zulassen, keine offenen Weiterleitungen.
  const target = isSafeInternalPath(next) ? next : homePathFor(user.role);
  redirect(target);
}

function isSafeInternalPath(path: string) {
  return /^\/(?![/\\])/.test(path) && !path.includes("\\");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
