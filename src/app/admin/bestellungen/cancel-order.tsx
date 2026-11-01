"use client";

import { Ban } from "lucide-react";
import { useState, useTransition } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { cancelOrderAction } from "./actions";

export function CancelOrder({
  orderId,
  number,
  refund,
  amount,
}: {
  orderId: string;
  number: number;
  /** Bezahlt: wird über Stripe erstattet */
  refund: boolean;
  amount: string;
}) {
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      try {
        const result = await cancelOrderAction(orderId, reason);
        if (result.ok) toast.success(result.message);
        else toast.error(result.message);
      } catch {
        toast.error("Das hat nicht geklappt. Bitte die Seite neu laden.");
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={pending}>
          <Ban /> Stornieren
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Bestellung {number} stornieren?</AlertDialogTitle>
          <AlertDialogDescription>
            {refund
              ? `Der Kunde bekommt ${amount} über Stripe erstattet und eine Mail. Die Slots werden wieder frei.`
              : "Die Reservierung endet sofort, die Slots werden wieder frei. Der Kunde bekommt eine Mail."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <label htmlFor="cancel-reason" className="text-sm font-medium">
          Grund (intern, optional)
        </label>
        <Textarea
          id="cancel-reason"
          value={reason}
          maxLength={200}
          rows={2}
          onChange={(e) => setReason(e.target.value)}
        />
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            onClick={confirm}
            className="bg-terracotta text-paper hover:bg-terracotta/90"
          >
            {refund ? "Stornieren und erstatten" : "Stornieren"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
