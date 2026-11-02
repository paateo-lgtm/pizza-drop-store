"use client";

import { Plus, Trash2 } from "lucide-react";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ContentKey, Faq, Landing, Legal } from "@/lib/content/schema";
import type { FormState } from "@/lib/validation/common";
import { saveContentForm } from "./actions";

/** Gemeinsamer Rahmen: Absenden ohne Zurücksetzen, Toast bei Erfolg, Fehler als Alert. */
function ContentForm({
  contentKey,
  children,
}: {
  contentKey: ContentKey;
  children: (errors: Record<string, string[] | undefined>) => ReactNode;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    saveContentForm.bind(null, contentKey),
    undefined,
  );
  const handled = useRef<FormState>(undefined);
  useEffect(() => {
    if (state?.ok && handled.current !== state) {
      handled.current = state;
      toast.success(state.message);
    }
  }, [state]);

  return (
    <form
      // Über onSubmit statt action={…}: React würde das Formular sonst nach jedem
      // Absenden zurücksetzen, auch wenn der Server Feldfehler meldet.
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => action(data));
      }}
      className="flex flex-col gap-4"
    >
      {children(state?.fieldErrors ?? {})}
      {state?.ok === false && state.message && (
        <p role="alert" className="text-sm text-terracotta">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Speichern …" : "Speichern"}
      </Button>
    </form>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string[];
  children: ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id} className="mb-2">
        {label}
      </Label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
      {error && <p className="mt-1 text-sm text-terracotta">{error[0]}</p>}
    </div>
  );
}

const LEGAL_FIELDS: {
  key: keyof Legal;
  label: string;
  required?: boolean;
  hint?: string;
  type?: string;
  wide?: boolean;
}[] = [
  {
    key: "operatorName",
    label: "Name bzw. Firma",
    required: true,
    hint: "Vor- und Nachname oder Firma mit Rechtsform",
  },
  { key: "email", label: "E-Mail", required: true, type: "email" },
  { key: "street", label: "Straße und Hausnummer", required: true },
  { key: "postalCity", label: "PLZ und Ort", required: true },
  { key: "phone", label: "Telefon", hint: "Empfohlen, nicht Pflicht" },
  { key: "vatId", label: "USt-IdNr.", hint: "Nur falls vorhanden" },
  {
    key: "responsible",
    label: "Verantwortlich für den Inhalt",
    hint: "Nur falls abweichend vom Betreiber (§ 18 Abs. 2 MStV)",
    wide: true,
  },
];

export function LegalForm({ legal }: { legal: Legal }) {
  return (
    <ContentForm contentKey="legal">
      {(errors) => (
        <div className="grid gap-4 sm:grid-cols-2">
          {LEGAL_FIELDS.map((f) => (
            <div key={f.key} className={f.wide ? "sm:col-span-2" : undefined}>
              <Field
                id={f.key}
                label={f.label}
                hint={f.hint}
                error={errors[f.key]}
              >
                <Input
                  id={f.key}
                  name={f.key}
                  type={f.type}
                  required={f.required}
                  defaultValue={legal[f.key]}
                />
              </Field>
            </div>
          ))}
        </div>
      )}
    </ContentForm>
  );
}

export function LandingForm({ landing }: { landing: Landing }) {
  return (
    <ContentForm contentKey="landing">
      {(errors) => (
        <>
          <Field
            id="noDropTitle"
            label="Überschrift, wenn kein Drop geplant ist"
            error={errors.noDropTitle}
          >
            <Input
              id="noDropTitle"
              name="noDropTitle"
              required
              defaultValue={landing.noDropTitle}
            />
          </Field>
          <Field id="noDropText" label="Text dazu" error={errors.noDropText}>
            <Textarea
              id="noDropText"
              name="noDropText"
              rows={2}
              defaultValue={landing.noDropText}
            />
          </Field>
          <Field
            id="alarmText"
            label="Text beim Drop-Alarm"
            error={errors.alarmText}
          >
            <Textarea
              id="alarmText"
              name="alarmText"
              rows={2}
              defaultValue={landing.alarmText}
            />
          </Field>
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-sm font-medium">
              „So funktioniert&apos;s“ – drei Schritte
            </legend>
            {landing.steps.map((step, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[12rem_1fr]">
                <Input
                  name={`step${i}Title`}
                  aria-label={`Schritt ${i + 1}: Titel`}
                  required
                  defaultValue={step.title}
                />
                <Input
                  name={`step${i}Text`}
                  aria-label={`Schritt ${i + 1}: Text`}
                  required
                  defaultValue={step.text}
                />
              </div>
            ))}
            {errors.steps && (
              <p className="text-sm text-terracotta">
                Bitte alle Schritte mit Titel und Text ausfüllen.
              </p>
            )}
          </fieldset>
        </>
      )}
    </ContentForm>
  );
}

let rowKey = 0;

export function FaqForm({ faq }: { faq: Faq }) {
  const [rows, setRows] = useState(() =>
    faq.map((row) => ({ ...row, key: ++rowKey })),
  );
  return (
    <ContentForm contentKey="faq">
      {() => (
        <>
          {rows.length === 0 && (
            <p className="text-sm text-ink-muted">
              Noch keine Fragen. Ohne Einträge zeigt die Startseite keinen
              FAQ-Bereich.
            </p>
          )}
          <ol className="flex flex-col gap-4">
            {rows.map((row, i) => (
              <li
                key={row.key}
                className="flex flex-col gap-2 rounded-md border border-line p-3"
              >
                <div className="flex items-center gap-2">
                  <Input
                    name="question"
                    aria-label={`Frage ${i + 1}`}
                    placeholder="Frage"
                    required
                    maxLength={200}
                    defaultValue={row.question}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Frage ${i + 1} entfernen`}
                    onClick={() =>
                      setRows((prev) => prev.filter((r) => r.key !== row.key))
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
                <Textarea
                  name="answer"
                  aria-label={`Antwort ${i + 1}`}
                  placeholder="Antwort"
                  required
                  maxLength={2000}
                  rows={3}
                  defaultValue={row.answer}
                />
              </li>
            ))}
          </ol>
          <Button
            type="button"
            variant="outline"
            className="self-start"
            onClick={() =>
              setRows((prev) => [
                ...prev,
                { question: "", answer: "", key: ++rowKey },
              ])
            }
          >
            <Plus /> Frage hinzufügen
          </Button>
        </>
      )}
    </ContentForm>
  );
}
