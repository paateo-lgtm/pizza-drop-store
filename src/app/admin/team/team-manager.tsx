"use client";

import { KeyRound, UserPlus } from "lucide-react";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { FormState } from "@/lib/validation/common";
import {
  createMember,
  resetPassword,
  setMemberActive,
  setMemberRole,
} from "./actions";

type Member = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "KITCHEN";
  active: boolean;
};

const selectClass =
  "border-input bg-surface h-9 rounded-md border px-2 text-sm focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none";

function useToastOnSuccess(state: FormState, onSuccess?: () => void) {
  const handled = useRef<FormState>(undefined);
  useEffect(() => {
    if (state?.ok && handled.current !== state) {
      handled.current = state;
      if (state.message) toast.success(state.message);
      onSuccess?.();
    }
  }, [state, onSuccess]);
}

export function TeamManager({
  members,
  currentUserId,
}: {
  members: Member[];
  currentUserId: string;
}) {
  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <ul className="divide-y divide-line rounded-md border border-line">
        {members.map((member) => (
          <MemberRow
            key={member.id}
            member={member}
            isMe={member.id === currentUserId}
          />
        ))}
      </ul>
      <CreateMemberForm />
    </div>
  );
}

function MemberRow({ member, isMe }: { member: Member; isMe: boolean }) {
  const [pending, start] = useTransition();
  const [showPassword, setShowPassword] = useState(false);

  function run(change: () => Promise<FormState>) {
    start(async () => {
      const result = await change();
      if (result?.ok === false && result.message) toast.error(result.message);
    });
  }

  return (
    <li className="bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div
          className={
            member.active ? "min-w-0 flex-1" : "min-w-0 flex-1 opacity-60"
          }
        >
          <p className="font-medium">
            {member.name} {isMe && <Badge variant="secondary">Du</Badge>}
          </p>
          <p className="truncate text-sm text-ink-muted">{member.email}</p>
        </div>
        <label className="sr-only" htmlFor={`role-${member.id}`}>
          Rolle von {member.name}
        </label>
        <select
          id={`role-${member.id}`}
          value={member.role}
          disabled={pending || isMe}
          onChange={(e) => run(() => setMemberRole(member.id, e.target.value))}
          className={selectClass}
        >
          <option value="ADMIN">Admin</option>
          <option value="KITCHEN">Küche</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-ink-muted">
            {member.active ? "Aktiv" : "Gesperrt"}
          </span>
          <Switch
            checked={member.active}
            disabled={pending || isMe}
            onCheckedChange={(active) =>
              run(() => setMemberActive(member.id, active))
            }
            aria-label={`${member.name} ${member.active ? "sperren" : "freischalten"}`}
          />
        </label>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Passwort für ${member.name} neu setzen`}
          aria-expanded={showPassword}
          onClick={() => setShowPassword((v) => !v)}
        >
          <KeyRound />
        </Button>
      </div>
      {showPassword && (
        <PasswordForm
          memberId={member.id}
          onDone={() => setShowPassword(false)}
        />
      )}
    </li>
  );
}

function PasswordForm({
  memberId,
  onDone,
}: {
  memberId: string;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    resetPassword.bind(null, memberId),
    undefined,
  );
  useToastOnSuccess(state, onDone);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => action(data));
      }}
      className="mt-3 flex flex-wrap items-start gap-2"
    >
      <div className="min-w-56 flex-1">
        <Label htmlFor={`pw-${memberId}`} className="sr-only">
          Neues Passwort
        </Label>
        <Input
          id={`pw-${memberId}`}
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="Neues Passwort (mind. 10 Zeichen)"
          required
        />
        {state?.fieldErrors?.password && (
          <p className="mt-1 text-sm text-terracotta">
            {state.fieldErrors.password[0]}
          </p>
        )}
      </div>
      <Button type="submit" disabled={pending}>
        Speichern
      </Button>
    </form>
  );
}

function CreateMemberForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(
    createMember,
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);
  useToastOnSuccess(state, () => formRef.current?.reset());
  const errors = state?.fieldErrors ?? {};

  return (
    <section>
      <h2 className="mb-4 border-b border-line pb-2 text-2xl">Neuer Zugang</h2>
      <form
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          startTransition(() => action(data));
        }}
        className="grid gap-4 sm:grid-cols-2"
      >
        <Field id="new-name" label="Name" error={errors.name}>
          <Input id="new-name" name="name" required />
        </Field>
        <Field id="new-email" label="E-Mail" error={errors.email}>
          <Input id="new-email" name="email" type="email" required />
        </Field>
        <Field id="new-role" label="Rolle" error={errors.role}>
          <select
            id="new-role"
            name="role"
            defaultValue="KITCHEN"
            className={`${selectClass} w-full`}
          >
            <option value="KITCHEN">Küche</option>
            <option value="ADMIN">Admin</option>
          </select>
        </Field>
        <Field id="new-password" label="Start-Passwort" error={errors.password}>
          <Input
            id="new-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending}>
            <UserPlus /> Zugang anlegen
          </Button>
        </div>
      </form>
    </section>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string[];
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id} className="mb-2">
        {label}
      </Label>
      {children}
      {error && <p className="mt-1 text-sm text-terracotta">{error[0]}</p>}
    </div>
  );
}
