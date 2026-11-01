"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { PayState } from "./actions";

export function PayForm({
  action,
  label,
}: {
  action: (prev: PayState, form: FormData) => Promise<PayState>;
  label: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="mt-4">
      <Button
        type="submit"
        size="lg"
        aria-disabled={pending}
        className="aria-disabled:opacity-50"
      >
        {pending ? "Weiter zu Stripe …" : label}
      </Button>
      {state?.message && (
        <p role="alert" className="mt-3 text-sm text-terracotta">
          {state.message}
        </p>
      )}
    </form>
  );
}
