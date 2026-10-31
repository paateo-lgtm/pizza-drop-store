"use client";

import { Copy, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { DropAction } from "@/lib/domain/drops";
import { changeDropStatus, deleteDrop, duplicateDrop } from "./actions";
import { ACTION_CONFIRM, ACTION_LABELS } from "./labels";

export function DropActions({
  dropId,
  title,
  actions,
  editable,
  deletable,
}: {
  dropId: string;
  title: string;
  actions: DropAction[];
  editable: boolean;
  deletable: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function run(action: DropAction) {
    startTransition(async () => {
      const result = await changeDropStatus(dropId, action);
      if (result?.ok === false && result.message) toast.error(result.message);
      else toast.success(`${ACTION_LABELS[action]}: erledigt`);
    });
  }

  // Der nächste Schritt im Ablauf ist die Hauptaktion; „absagen“ steht immer zuletzt.
  const [primary, ...rest] = actions.filter((a) => a !== "cancel");
  const canCancel = actions.includes("cancel");

  return (
    <div className="flex flex-wrap items-center gap-2">
      {editable && (
        <Button variant="outline" asChild>
          <Link href={`/admin/drops/${dropId}/bearbeiten`}>
            <Pencil /> Bearbeiten
          </Link>
        </Button>
      )}
      <Button
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await duplicateDrop(dropId);
            if (result?.message) toast.error(result.message);
          })
        }
      >
        <Copy /> Duplizieren
      </Button>
      {rest.map((action) => (
        <ActionButton
          key={action}
          action={action}
          pending={pending}
          onConfirm={() => run(action)}
          variant="outline"
        />
      ))}
      {canCancel && (
        <ActionButton
          action="cancel"
          pending={pending}
          onConfirm={() => run("cancel")}
          variant="ghost"
        />
      )}
      {deletable && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              disabled={pending}
              aria-label="Drop löschen"
            >
              <Trash2 />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>„{title}“ löschen?</AlertDialogTitle>
              <AlertDialogDescription>
                Der Drop und sein Raster werden endgültig entfernt.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  startTransition(async () => {
                    const result = await deleteDrop(dropId);
                    if (result?.message) toast.error(result.message);
                  })
                }
              >
                Endgültig löschen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {primary && (
        <ActionButton
          action={primary}
          pending={pending}
          onConfirm={() => run(primary)}
        />
      )}
    </div>
  );
}

function ActionButton({
  action,
  pending,
  onConfirm,
  variant = "default",
}: {
  action: DropAction;
  pending: boolean;
  onConfirm: () => void;
  variant?: "default" | "outline" | "ghost";
}) {
  const confirm = ACTION_CONFIRM[action];
  const button = (
    <Button
      variant={variant}
      disabled={pending}
      onClick={confirm ? undefined : onConfirm}
      className={action === "cancel" ? "text-terracotta" : undefined}
    >
      {ACTION_LABELS[action]}
    </Button>
  );
  if (!confirm) return button;
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{button}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{ACTION_LABELS[action]}?</AlertDialogTitle>
          <AlertDialogDescription>{confirm}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {ACTION_LABELS[action]}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
