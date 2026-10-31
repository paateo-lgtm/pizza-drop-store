/**
 * Data Access Layer für die Anmeldung: jede Seite und jede Server Action prüft hier,
 * nicht nur im Proxy. Deaktivierte Nutzer verlieren sofort den Zugriff.
 */
import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { can, homePathFor, type Permission, type Role } from "./permissions";
import { readSession } from "./session";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await readSession();
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      sessionVersion: true,
    },
  });
  // Nach Passwort-, Rollen- oder Statusänderung passt die Version nicht mehr.
  if (!user?.active || user.sessionVersion !== session.version) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
});

/** Für Seiten und Server Actions: angemeldet und mit der nötigen Berechtigung, sonst Weiterleitung. */
export async function requireUser(permission?: Permission) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (permission && !can(user.role, permission)) {
    redirect(homePathFor(user.role));
  }
  return user;
}
