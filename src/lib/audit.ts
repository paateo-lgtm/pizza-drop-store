import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

type AuditEntry = {
  userId: string;
  action:
    | "create"
    | "update"
    | "delete"
    | "activate"
    | "deactivate"
    | "reorder"
    | "login"
    | "status"
    | "duplicate"
    | "block"
    | "unblock"
    | "cancel";
  entity: "pizza" | "ingredient" | "settings" | "user" | "drop" | "order";
  entityId?: string;
  diff?: Prisma.InputJsonValue;
};

/** Protokolliert Änderungen im Admin-Bereich. Ein Fehler hier darf die eigentliche Aktion nicht abbrechen. */
export async function audit(entry: AuditEntry) {
  try {
    await db.auditLog.create({ data: entry });
  } catch (error) {
    console.error("Audit-Log konnte nicht geschrieben werden", error);
  }
}

/** Nur geänderte Felder festhalten, damit das Protokoll lesbar bleibt. */
export function changedFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): Prisma.InputJsonValue {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    const from = before[key];
    const to = after[key];
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      diff[key] = { from, to };
    }
  }
  return diff as Prisma.InputJsonValue;
}
