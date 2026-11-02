import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  isLegalComplete,
  parseContent,
  type Content,
  type ContentKey,
} from "./schema";

export async function getContent<K extends ContentKey>(
  key: K,
): Promise<Content[K]> {
  const row = await db.siteContent.findUnique({ where: { key } });
  return parseContent(key, row?.value);
}

export async function saveContent<K extends ContentKey>(
  key: K,
  value: Content[K],
) {
  const json = value as Prisma.InputJsonValue;
  await db.siteContent.upsert({
    where: { key },
    update: { value: json },
    create: { key, value: json },
  });
}

/** Impressum vollständig? Davon hängen die Formulare ab, die Adressen sammeln. */
export async function legalReady(): Promise<boolean> {
  return isLegalComplete(await getContent("legal"));
}
