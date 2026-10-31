"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "./actions";

export function LoginForm() {
  const next = useSearchParams().get("next");
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form action={action} className="mt-8 flex flex-col gap-5">
      <input type="hidden" name="next" value={next ?? ""} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">E-Mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={state?.email}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Passwort</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-terracotta">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Anmelden …" : "Anmelden"}
      </Button>
    </form>
  );
}
