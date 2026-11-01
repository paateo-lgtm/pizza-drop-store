"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { resendOrderMail } from "./actions";

export function ResendMail({
  orderId,
  kind,
}: {
  orderId: string;
  kind: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="xs"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            const result = await resendOrderMail(orderId, kind);
            if (result.ok) toast.success(result.message);
            else toast.error(result.message);
          } catch {
            toast.error("Das hat nicht geklappt. Bitte die Seite neu laden.");
          }
        })
      }
    >
      Erneut senden
    </Button>
  );
}
