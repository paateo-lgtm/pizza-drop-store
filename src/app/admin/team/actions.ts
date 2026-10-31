"use server";

import bcrypt from "bcryptjs";
import { refresh } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/dal";
import { createSession } from "@/lib/auth/session";
import { teamChangeError } from "@/lib/auth/team-rules";
import { db } from "@/lib/db";
import { emailSchema, passwordSchema } from "@/lib/validation/auth";
import { toFormState, type FormState } from "@/lib/validation/common";

const roleSchema = z.enum(["ADMIN", "KITCHEN"]);

const createSchema = z.object({
  name: z.string().trim().min(2, "Mindestens 2 Zeichen").max(60),
  email: emailSchema,
  role: roleSchema,
  password: passwordSchema,
});

export async function createMember(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser("team:manage");
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toFormState(parsed.error);
  const { password, ...data } = parsed.data;

  try {
    const created = await db.user.create({
      data: { ...data, passwordHash: await bcrypt.hash(password, 12) },
    });
    await audit({
      userId: user.id,
      action: "create",
      entity: "user",
      entityId: created.id,
      diff: { email: created.email, role: created.role },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        fieldErrors: { email: ["Diese E-Mail ist schon vergeben"] },
      };
    }
    throw error;
  }
  refresh();
  return { ok: true, message: `Zugang für ${data.name} angelegt` };
}

async function applyChange(change: {
  targetId: string;
  role?: "ADMIN" | "KITCHEN";
  active?: boolean;
}) {
  const user = await requireUser("team:manage");
  const { targetId, ...data } = change;

  // Prüfen und Ändern in einer serialisierbaren Transaktion: Zwei Admins, die sich
  // gleichzeitig gegenseitig herabstufen, dürfen nicht beide durchkommen.
  const error = await db.$transaction(
    async (tx) => {
      const members = await tx.user.findMany({
        select: { id: true, role: true, active: true },
      });
      const problem = teamChangeError(members, user.id, change);
      if (problem) return problem;
      await tx.user.update({
        where: { id: targetId },
        data: { ...data, sessionVersion: { increment: 1 } },
      });
      return null;
    },
    { isolationLevel: "Serializable" },
  );
  if (error) return { ok: false, message: error } satisfies FormState;

  await audit({
    userId: user.id,
    action:
      change.active === undefined
        ? "update"
        : change.active
          ? "activate"
          : "deactivate",
    entity: "user",
    entityId: targetId,
    diff: data,
  });
  refresh();
  return { ok: true } satisfies FormState;
}

export async function setMemberActive(
  targetId: string,
  active: boolean,
): Promise<FormState> {
  return applyChange({ targetId: z.string().min(1).parse(targetId), active });
}

export async function setMemberRole(
  targetId: string,
  role: string,
): Promise<FormState> {
  return applyChange({
    targetId: z.string().min(1).parse(targetId),
    role: roleSchema.parse(role),
  });
}

export async function resetPassword(
  targetId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser("team:manage");
  const parsed = z.object({ password: passwordSchema }).safeParse({
    password: formData.get("password"),
  });
  if (!parsed.success) return toFormState(parsed.error);
  const id = z.string().min(1).parse(targetId);

  const target = await db.user.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!target)
    return { ok: false, message: "Diesen Zugang gibt es nicht mehr." };

  // Neue Sitzungsversion: alle bestehenden Anmeldungen dieses Zugangs enden.
  const updated = await db.user.update({
    where: { id },
    data: {
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
      sessionVersion: { increment: 1 },
    },
    select: { role: true, sessionVersion: true },
  });
  if (id === user.id) {
    // Wer das eigene Passwort ändert, bleibt auf diesem Gerät angemeldet.
    await createSession({
      userId: id,
      role: updated.role,
      version: updated.sessionVersion,
    });
  }
  await audit({
    userId: user.id,
    action: "update",
    entity: "user",
    entityId: id,
    diff: { password: "neu gesetzt", sessions: "beendet" },
  });
  return {
    ok: true,
    message: "Neues Passwort gespeichert, alte Anmeldungen beendet",
  };
}
