import type { Role } from "./permissions";

type Member = { id: string; role: Role; active: boolean };
type Change = { targetId: string; role?: Role; active?: boolean };

/**
 * Prüft Änderungen am Team: niemand sperrt sich selbst aus, und es bleibt
 * immer mindestens ein aktiver Admin. Liefert eine Fehlermeldung oder null.
 */
export function teamChangeError(
  members: Member[],
  actorId: string,
  change: Change,
): string | null {
  const target = members.find((m) => m.id === change.targetId);
  if (!target) return "Diesen Zugang gibt es nicht mehr.";

  if (target.id === actorId) {
    if (change.active === false)
      return "Du kannst dich nicht selbst deaktivieren.";
    if (change.role && change.role !== target.role) {
      return "Du kannst deine eigene Rolle nicht ändern.";
    }
  }

  const after = members.map((m) =>
    m.id === target.id
      ? { ...m, role: change.role ?? m.role, active: change.active ?? m.active }
      : m,
  );
  if (!after.some((m) => m.role === "ADMIN" && m.active)) {
    return "Es muss mindestens ein aktiver Admin bleiben.";
  }
  return null;
}
