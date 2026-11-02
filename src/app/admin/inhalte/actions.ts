"use server";

import { revalidatePath } from "next/cache";
import { audit, changedFields } from "@/lib/audit";
import { requireUser } from "@/lib/auth/dal";
import {
  CONTENT_SCHEMAS,
  type Content,
  type ContentKey,
} from "@/lib/content/schema";
import { getContent, saveContent } from "@/lib/content/store";
import { toFormState, type FormState } from "@/lib/validation/common";

const text = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "");

/** FormData → Rohobjekt je Inhalt; geprüft wird mit dem Schema aus lib/content. */
const fromForm: Record<ContentKey, (formData: FormData) => unknown> = {
  legal: (f) => ({
    operatorName: text(f, "operatorName"),
    street: text(f, "street"),
    postalCity: text(f, "postalCity"),
    email: text(f, "email").trim(),
    phone: text(f, "phone"),
    vatId: text(f, "vatId"),
    responsible: text(f, "responsible"),
  }),
  landing: (f) => ({
    noDropTitle: text(f, "noDropTitle"),
    noDropText: text(f, "noDropText"),
    alarmText: text(f, "alarmText"),
    steps: [0, 1, 2].map((i) => ({
      title: text(f, `step${i}Title`),
      text: text(f, `step${i}Text`),
    })),
  }),
  faq: (f) => {
    const answers = f.getAll("answer").map(String);
    return (
      f
        .getAll("question")
        .map((q, i) => ({ question: String(q), answer: answers[i] ?? "" }))
        // Ganz leere Zeilen (z. B. eine frisch hinzugefügte) einfach weglassen
        .filter((row) => row.question.trim() || row.answer.trim())
    );
  },
};

const SAVED: Record<ContentKey, string> = {
  legal: "Betreiberangaben gespeichert",
  landing: "Startseite gespeichert",
  faq: "FAQ gespeichert",
};

export async function saveContentForm(
  key: ContentKey,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser("content:manage");
  const parsed = CONTENT_SCHEMAS[key].safeParse(fromForm[key](formData));
  if (!parsed.success) return toFormState(parsed.error);

  const before = await getContent(key);
  await saveContent(key, parsed.data as Content[typeof key]);
  await audit({
    userId: user.id,
    action: "update",
    entity: "content",
    entityId: key,
    diff:
      key === "legal"
        ? changedFields(
            before as Record<string, unknown>,
            parsed.data as Record<string, unknown>,
          )
        : { [key]: "geändert" },
  });
  // Startseite, Rechtsseiten und Formulare hängen an diesen Inhalten
  revalidatePath("/", "layout");
  return { ok: true, message: SAVED[key] };
}
