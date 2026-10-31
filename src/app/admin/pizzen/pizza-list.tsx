"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useId, useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { reorderPizzas, setPizzaActive } from "./actions";

export type PizzaRow = {
  id: string;
  name: string;
  priceCents: number;
  imageUrl: string | null;
  active: boolean;
  tags: string[];
  ingredientCount: number;
};

export function PizzaList({ pizzas }: { pizzas: PizzaRow[] }) {
  const dndId = useId();
  const [, startTransition] = useTransition();
  const [items, setOptimistic] = useOptimistic(pizzas);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-line p-10 text-center">
        <p className="font-serif text-2xl">Noch keine Pizzen</p>
        <p className="mt-2 text-sm text-ink-muted">
          Leg die erste Pizza an, um sie später einem Drop zuzuordnen.
        </p>
        <Button asChild className="mt-6">
          <Link href="/admin/pizzen/neu">Erste Pizza anlegen</Link>
        </Button>
      </div>
    );
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((p) => p.id === active.id);
    const to = items.findIndex((p) => p.id === over.id);
    const next = arrayMove(items, from, to);
    startTransition(async () => {
      setOptimistic(next);
      try {
        await reorderPizzas(next.map((p) => p.id));
      } catch {
        toast.error("Reihenfolge konnte nicht gespeichert werden.");
      }
    });
  }

  function onToggle(pizza: PizzaRow, active: boolean) {
    startTransition(async () => {
      setOptimistic(
        items.map((p) => (p.id === pizza.id ? { ...p, active } : p)),
      );
      try {
        await setPizzaActive(pizza.id, active);
        toast.success(
          `„${pizza.name}“ ${active ? "aktiviert" : "deaktiviert"}`,
        );
      } catch {
        toast.error("Änderung konnte nicht gespeichert werden.");
      }
    });
  }

  return (
    <DndContext
      // Stabile ID, sonst weichen die aria-describedby-IDs zwischen Server und Client ab.
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Leertaste drücken, um die Pizza aufzunehmen. Mit den Pfeiltasten verschieben, mit Leertaste ablegen.",
        },
      }}
    >
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <ul className="divide-y divide-line rounded-md border border-line">
          {items.map((pizza) => (
            <SortableRow key={pizza.id} pizza={pizza} onToggle={onToggle} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  pizza,
  onToggle,
}: {
  pizza: PizzaRow;
  onToggle: (pizza: PizzaRow, active: boolean) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: pizza.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-3 bg-surface px-3 py-3 sm:gap-4",
        isDragging && "relative z-10 shadow-md",
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded p-1 text-ink-muted hover:text-ink active:cursor-grabbing"
        aria-label={`${pizza.name} verschieben`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <div className="relative hidden aspect-[4/3] w-16 shrink-0 overflow-hidden rounded border border-line bg-wash sm:block">
        {pizza.imageUrl ? (
          <Image
            src={pizza.imageUrl}
            alt=""
            fill
            sizes="64px"
            className="object-cover"
          />
        ) : (
          <span className="flex h-full items-center justify-center font-serif text-ink-muted italic">
            {pizza.name.slice(0, 1)}
          </span>
        )}
      </div>
      <div className={cn("min-w-0 flex-1", !pizza.active && "opacity-60")}>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <Link
            href={`/admin/pizzen/${pizza.id}`}
            className="font-serif text-xl hover:underline"
          >
            {pizza.name}
          </Link>
          <span className="text-sm tabular-nums">
            {formatPrice(pizza.priceCents)}
          </span>
          {pizza.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
        <p className="text-xs text-ink-muted">
          {pizza.ingredientCount === 0
            ? "Noch kein Rezept hinterlegt"
            : `${pizza.ingredientCount} Zutaten im Rezept`}
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <span className="hidden text-ink-muted sm:inline">
          {pizza.active ? "Aktiv" : "Inaktiv"}
        </span>
        <Switch
          checked={pizza.active}
          onCheckedChange={(checked) => onToggle(pizza, checked)}
          aria-label={`${pizza.name} ${pizza.active ? "deaktivieren" : "aktivieren"}`}
        />
      </label>
      <Button variant="ghost" size="icon" asChild>
        <Link
          href={`/admin/pizzen/${pizza.id}`}
          aria-label={`${pizza.name} bearbeiten`}
        >
          <Pencil />
        </Link>
      </Button>
    </li>
  );
}
