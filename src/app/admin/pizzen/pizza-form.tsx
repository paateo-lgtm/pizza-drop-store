"use client";

import { ImageUp, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ALLERGENS, SUGGESTED_TAGS, UNIT_LABELS } from "@/lib/constants";
import { slugify, type FormState } from "@/lib/validation/common";
import { savePizza } from "./actions";

export type IngredientOption = {
  id: string;
  name: string;
  unit: keyof typeof UNIT_LABELS;
  allergen: string | null;
};

export type PizzaFormValues = {
  id: string | null;
  name: string;
  slug: string;
  description: string;
  price: string;
  imageUrl: string | null;
  allergens: string[];
  tags: string[];
  active: boolean;
  recipe: { ingredientId: string; amount: string }[];
};

let rowKey = 0;
const withKey = (row: { ingredientId: string; amount: string }) => ({
  ...row,
  key: ++rowKey,
});

export function PizzaForm({
  initial,
  ingredients,
}: {
  initial: PizzaFormValues;
  ingredients: IngredientOption[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    savePizza.bind(null, initial.id),
    undefined,
  );
  const [name, setName] = useState(initial.name);
  const [slugTouched, setSlugTouched] = useState(initial.id !== null);
  const [slug, setSlug] = useState(initial.slug);
  const [recipe, setRecipe] = useState(() => initial.recipe.map(withKey));
  const [allergens, setAllergens] = useState(new Set(initial.allergens));
  const [preview, setPreview] = useState<string | null>(initial.imageUrl);
  const [removeImage, setRemoveImage] = useState(false);

  const errors = state?.fieldErrors ?? {};
  const customTags = initial.tags.filter(
    (t) => !(SUGGESTED_TAGS as readonly string[]).includes(t),
  );
  const ingredientById = new Map(ingredients.map((i) => [i.id, i]));
  const recipeAllergens = new Set(
    recipe
      .map((r) => ingredientById.get(r.ingredientId)?.allergen)
      .filter((a): a is string => !!a),
  );
  const missingAllergens = [...recipeAllergens].filter(
    (a) => !allergens.has(a),
  );

  return (
    <form
      // Über onSubmit statt action={…}: React würde das Formular sonst nach jedem
      // Absenden zurücksetzen, auch wenn der Server Feldfehler meldet.
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => action(data));
      }}
      className="grid max-w-5xl gap-10 lg:grid-cols-[1fr_18rem]"
    >
      <div className="flex flex-col gap-8">
        <Section title="Grunddaten">
          <Field label="Name" htmlFor="name" error={errors.name}>
            <Input
              id="name"
              name="name"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
            />
          </Field>
          <Field
            label="Kurzname in der Adresse"
            htmlFor="slug"
            error={errors.slug}
            hint={`/drop/…/${slug || "name"}`}
          >
            <Input
              id="slug"
              name="slug"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
            />
          </Field>
          <Field
            label="Beschreibung"
            htmlFor="description"
            error={errors.description}
          >
            <Textarea
              id="description"
              name="description"
              required
              rows={3}
              defaultValue={initial.description}
            />
          </Field>
          <Field
            label="Preis (inkl. MwSt.)"
            htmlFor="price"
            error={errors.price}
          >
            <div className="relative max-w-40">
              <Input
                id="price"
                name="price"
                inputMode="decimal"
                required
                defaultValue={initial.price}
                className="pr-8 tabular-nums"
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-ink-muted">
                €
              </span>
            </div>
          </Field>
        </Section>

        <Section
          title="Rezept"
          description="Menge pro Pizza. Daraus entstehen später die Vorbereitungsliste und die Zutatenangabe für Kunden."
        >
          {ingredients.length === 0 ? (
            <p className="text-sm text-ink-muted">
              Noch keine Zutaten angelegt.{" "}
              <Link href="/admin/zutaten" className="text-olive underline">
                Zutaten anlegen
              </Link>
            </p>
          ) : (
            <>
              <ul className="flex flex-col gap-2">
                {recipe.map((row, i) => {
                  const unit = ingredientById.get(row.ingredientId)?.unit;
                  return (
                    <li key={row.key} className="flex items-center gap-2">
                      <select
                        name={`recipe.${i}.ingredientId`}
                        aria-label={`Zutat ${i + 1}`}
                        value={row.ingredientId}
                        onChange={(e) =>
                          setRecipe((rows) =>
                            rows.map((r) =>
                              r.key === row.key
                                ? { ...r, ingredientId: e.target.value }
                                : r,
                            ),
                          )
                        }
                        className="h-9 min-w-0 flex-1 rounded-md border border-input bg-surface px-2 text-sm focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        <option value="">Zutat wählen …</option>
                        {ingredients.map((ing) => (
                          <option key={ing.id} value={ing.id}>
                            {ing.name}
                          </option>
                        ))}
                      </select>
                      <Input
                        name={`recipe.${i}.amount`}
                        aria-label={`Menge Zutat ${i + 1}`}
                        inputMode="decimal"
                        className="w-24 tabular-nums"
                        value={row.amount}
                        onChange={(e) =>
                          setRecipe((rows) =>
                            rows.map((r) =>
                              r.key === row.key
                                ? { ...r, amount: e.target.value }
                                : r,
                            ),
                          )
                        }
                      />
                      <span className="w-10 text-sm text-ink-muted">
                        {unit ? UNIT_LABELS[unit] : ""}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Zutat ${i + 1} entfernen`}
                        onClick={() =>
                          setRecipe((rows) =>
                            rows.filter((r) => r.key !== row.key),
                          )
                        }
                      >
                        <Trash2 />
                      </Button>
                    </li>
                  );
                })}
              </ul>
              {errors.recipe && <FieldError messages={errors.recipe} />}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() =>
                  setRecipe((rows) => [
                    ...rows,
                    withKey({ ingredientId: "", amount: "" }),
                  ])
                }
              >
                <Plus /> Zutat hinzufügen
              </Button>
            </>
          )}
        </Section>

        <Section title="Allergene & Kennzeichnung">
          <fieldset>
            <legend className="mb-3 text-sm font-medium">Allergene</legend>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
              {ALLERGENS.map((allergen) => (
                <label
                  key={allergen}
                  className="flex items-center gap-2 text-sm"
                >
                  <Checkbox
                    name="allergens"
                    value={allergen}
                    checked={allergens.has(allergen)}
                    onCheckedChange={(checked) =>
                      setAllergens((prev) => {
                        const next = new Set(prev);
                        if (checked) next.add(allergen);
                        else next.delete(allergen);
                        return next;
                      })
                    }
                  />
                  {allergen}
                </label>
              ))}
            </div>
            {missingAllergens.length > 0 && (
              <p className="mt-3 text-sm text-ochre">
                Laut Rezept enthalten, aber nicht angehakt:{" "}
                {missingAllergens.join(", ")}
              </p>
            )}
            {errors.allergens && <FieldError messages={errors.allergens} />}
          </fieldset>
          <fieldset>
            <legend className="mb-3 text-sm font-medium">Tags</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {SUGGESTED_TAGS.map((tag) => (
                <label key={tag} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    name="tags"
                    value={tag}
                    defaultChecked={initial.tags.includes(tag)}
                  />
                  {tag}
                </label>
              ))}
            </div>
            <Field
              label="Weitere Tags (kommagetrennt)"
              htmlFor="customTags"
              error={errors.tags}
              className="mt-4"
            >
              <Input
                id="customTags"
                name="customTags"
                defaultValue={customTags.join(", ")}
              />
            </Field>
          </fieldset>
        </Section>
      </div>

      <aside className="flex flex-col gap-8 lg:sticky lg:top-8 lg:self-start">
        <Section title="Bild">
          <div className="relative aspect-[4/3] overflow-hidden rounded-md border border-line bg-wash">
            {preview && !removeImage ? (
              <Image
                src={preview}
                alt=""
                fill
                sizes="288px"
                className="object-cover"
                unoptimized={preview.startsWith("blob:")}
              />
            ) : (
              <span className="flex h-full items-center justify-center font-serif text-3xl text-ink-muted italic">
                {name.slice(0, 1) || "?"}
              </span>
            )}
          </div>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-line px-3 py-2 text-sm hover:border-olive">
            <ImageUp className="size-4" aria-hidden />
            Bild auswählen
            <input
              type="file"
              name="image"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setPreview(URL.createObjectURL(file));
                  setRemoveImage(false);
                }
              }}
            />
          </label>
          <p className="text-xs text-ink-muted">
            JPG, PNG, WebP oder AVIF, max. 3 MB.
          </p>
          {initial.imageUrl && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                name="removeImage"
                checked={removeImage}
                onCheckedChange={(c) => setRemoveImage(c === true)}
              />
              Bild entfernen
            </label>
          )}
          {errors.image && <FieldError messages={errors.image} />}
        </Section>

        <Section title="Status">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>
              Aktiv
              <span className="block text-xs text-ink-muted">
                Nur aktive Pizzen lassen sich Drops zuordnen.
              </span>
            </span>
            <Switch name="active" defaultChecked={initial.active} />
          </label>
        </Section>

        <div className="flex flex-col gap-3">
          {state?.message && (
            <p role="alert" className="text-sm text-terracotta">
              {state.message}
            </p>
          )}
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Speichern …" : "Speichern"}
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/admin/pizzen">Abbrechen</Link>
          </Button>
        </div>
      </aside>
    </form>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="border-b border-line pb-2">
        <h2 className="text-2xl">{title}</h2>
        {description && <p className="text-sm text-ink-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string[];
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} className="mb-2">
        {label}
      </Label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
      {error && <FieldError messages={error} />}
    </div>
  );
}

function FieldError({ messages }: { messages: string[] }) {
  return <p className="mt-1 text-sm text-terracotta">{messages[0]}</p>;
}
