"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError, FieldHint } from "@/components/ui/Field";
import { changePasswordAction, type ChangePasswordState } from "./actions";

const initialState: ChangePasswordState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <KeyRound className="h-4 w-4" />
      {pending ? "Salvataggio…" : "Aggiorna password"}
    </Button>
  );
}

export function ChangePasswordForm() {
  const [state, formAction] = useActionState(changePasswordAction, initialState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <div>
        <Label htmlFor="currentPassword">Password attuale</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div>
        <Label htmlFor="newPassword">Nuova password</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <FieldHint>Almeno 8 caratteri.</FieldHint>
      </div>
      <div>
        <Label htmlFor="confirmPassword">Conferma nuova password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      {state.error && (
        <div className="rounded-xl bg-red-50 px-3.5 py-2.5">
          <FieldError>{state.error}</FieldError>
        </div>
      )}
      <SubmitButton />
    </form>
  );
}
