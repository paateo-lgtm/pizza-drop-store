/**
 * Rollen und Berechtigungen des Teams. Reine Funktionen, damit Server Actions,
 * Seiten und Navigation dieselben Regeln nutzen.
 */
export type Role = "ADMIN" | "KITCHEN";

export const PERMISSIONS = [
  "pizzas:manage",
  "drops:manage",
  "orders:view",
  "kitchen:use",
  "reports:view",
  "content:manage",
  "settings:manage",
  "team:manage",
  "audit:view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ADMIN: PERMISSIONS,
  KITCHEN: ["orders:view", "kitchen:use"],
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** Startseite nach dem Login: Admins in den Admin-Bereich, die Küche in den Kitchen-Mode. */
export function homePathFor(role: Role): string {
  return role === "ADMIN" ? "/admin" : "/kitchen";
}
