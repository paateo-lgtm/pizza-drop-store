"use client";

import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ALLERGENS, UNIT_LABELS } from "@/lib/constants";
import type { FormState } from "@/lib/validation/common";
import { deleteIngredient, saveIngredient } from "./actions";

type Unit = keyof typeof UNIT_LABELS;

export type IngredientRow = {
  id: string;
  name: string;
  unit: Unit;
  allergen: string | null;
  usedIn: number;
};

const selectClass =
  "border-input bg-surface focus-visible:ring-ring/50 h-9 rounded-md border px-2 text-sm focus-visible:ring-[3px] focus-visible:outline-none";

export function IngredientTable({
  ingredients,
}: {
  ingredients: IngredientRow[];
}) {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="max-w-3xl">
      <IngredientForm key="new" ingredient={null} />
      {ingredients.length === 0 ? (
        <p className="mt-8 text-sm text-ink-muted">
          Noch keine Zutaten. Leg oben die erste an.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-line rounded-md border border-line">
          {ingredients.map((ingredient) =>
            editing === ingredient.id ? (
              <li key={ingredient.id} className="bg-surface p-3">
                <IngredientForm
                  ingredient={ingredient}
                  onDone={() => setEditing(null)}
                />
              </li>
            ) : (
              <ReadRow
                key={ingredient.id}
                ingredient={ingredient}
                onEdit={() => setEditing(ingredient.id)}
              />
            ),
          )}
        </ul>
      )}
    </div>
  );
}

function ReadRow({
  ingredient,
  onEdit,
}: {
  ingredient: IngredientRow;
  onEdit: () => void;
}) {
  const [pending, startDelete] = useTransition();
  return (
    <li className="flex items-center gap-4 bg-surface px-4 py-3">
      <span className="flex-1 font-medium">{ingredient.name}</span>
      <span className="w-12 text-sm text-ink-muted">
        {UNIT_LABELS[ingredient.unit]}
      </span>
      <span className="hidden w-28 text-sm text-ink-muted sm:block">
        {ingredient.allergen ?? "–"}
      </span>
      <span className="hidden w-24 text-right text-xs text-ink-muted sm:block">
        {ingredient.usedIn === 0
          ? "nicht verwendet"
          : `in ${ingredient.usedIn} Rezept${ingredient.usedIn === 1 ? "" : "en"}`}
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={onEdit}
        aria-label={`${ingredient.name} bearbeiten`}
      >
        <Pencil />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        disabled={pending}
        aria-label={`${ingredient.name} löschen`}
        onClick={() =>
          startDelete(async () => {
            const result = await deleteIngredient(ingredient.id);
            if (result?.ok) toast.success(result.message);
            else if (result?.message) toast.error(result.message);
          })
        }
      >
        <Trash2 />
      </Button>
    </li>
  );
}

function IngredientForm({
  ingredient,
  onDone,
}: {
  ingredient: IngredientRow | null;
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    saveIngredient.bind(null, ingredient?.id ?? null),
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const handled = useRef<FormState>(undefined);

  useEffect(() => {
    if (state?.ok && handled.current !== state) {
      handled.current = state;
      toast.success(state.message);
      if (ingredient) onDone?.();
      else formRef.current?.reset(); // leeres Formular für die nächste Zutat
    }
  }, [state, ingredient, onDone]);

  const prefix = ingredient ? `edit-${ingredient.id}` : "new";

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => action(data));
      }}
      className="flex flex-wrap items-start gap-2"
    >
      <div className="min-w-48 flex-1">
        <label htmlFor={`${prefix}-name`} className="sr-only">
          Name
        </label>
        <Input
          id={`${prefix}-name`}
          name="name"
          placeholder="Neue Zutat, z. B. Burrata"
          defaultValue={ingredient?.name}
          required
          aria-invalid={!!state?.fieldErrors?.name}
        />
        {state?.fieldErrors?.name && (
          <p className="mt-1 text-sm text-terracotta">
            {state.fieldErrors.name[0]}
          </p>
        )}
      </div>
      <label className="sr-only" htmlFor={`${prefix}-unit`}>
        Einheit
      </label>
      <select
        id={`${prefix}-unit`}
        name="unit"
        defaultValue={ingredient?.unit ?? "GRAM"}
        className={selectClass}
      >
        {Object.entries(UNIT_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor={`${prefix}-allergen`}>
        Allergen
      </label>
      <select
        id={`${prefix}-allergen`}
        name="allergen"
        defaultValue={ingredient?.allergen ?? ""}
        className={selectClass}
      >
        <option value="">kein Allergen</option>
        {ALLERGENS.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
      {ingredient ? (
        <>
          <Button
            type="submit"
            size="icon"
            disabled={pending}
            aria-label="Speichern"
          >
            <Check />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onDone}
            aria-label="Abbrechen"
          >
            <X />
          </Button>
        </>
      ) : (
        <Button type="submit" disabled={pending}>
          <Plus /> Hinzufügen
        </Button>
      )}
    </form>
  );
}
