"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, KeyRound, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError, FieldHint } from "@/components/ui/Field";
import { updateStaffAction, type UpdateStaffFormState } from "./actions";
import type { StaffMember } from "@/lib/types";

const initialState: UpdateStaffFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Save className="h-4 w-4" />
      {pending ? "Salvataggio…" : "Salva modifiche"}
    </Button>
  );
}

export function EditStaffForm({ member }: { member: StaffMember }) {
  const [state, formAction] = useActionState(updateStaffAction, initialState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="id" value={member.id} />

      <div>
        <Label htmlFor="fullName">Nome e cognome</Label>
        <Input id="fullName" name="fullName" defaultValue={member.fullName} required />
      </div>
      <div>
        <Label htmlFor="username">Nome utente</Label>
        <Input id="username" name="username" defaultValue={member.username} required />
      </div>
      <div>
        <Label htmlFor="newPassword" className="flex items-center gap-1.5">
          <KeyRound className="h-3.5 w-3.5" />
          Nuova password temporanea (opzionale)
        </Label>
        <Input id="newPassword" name="newPassword" minLength={8} placeholder="Lascia vuoto per non cambiarla" />
        <FieldHint>
          Se la imposti, l&apos;admin dovrà cambiarla al prossimo accesso. Almeno 8 caratteri.
        </FieldHint>
      </div>

      {state.error && (
        <div className="rounded-xl bg-destructive/8 px-3.5 py-2.5">
          <FieldError>{state.error}</FieldError>
        </div>
      )}

      {state.saved && (
        <div className="rounded-xl border border-[var(--color-u14)]/30 bg-[var(--color-u14-soft)] px-4 py-3 text-sm text-[var(--color-u14-strong)]">
          <p className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Modifiche salvate
          </p>
          {state.resetPassword && (
            <p className="mt-2 rounded-lg bg-white/60 px-3 py-2 font-mono text-xs">
              Utente: <strong>{state.resetPassword.username}</strong>
              <br />
              Nuova password: <strong>{state.resetPassword.password}</strong>
            </p>
          )}
        </div>
      )}

      <SubmitButton />
    </form>
  );
}
