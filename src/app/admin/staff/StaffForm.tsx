"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError, FieldHint } from "@/components/ui/Field";
import { createStaffAction, type StaffFormState } from "./actions";

const initialState: StaffFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <UserPlus className="h-4 w-4" />
      {pending ? "Creazione…" : "Crea account admin"}
    </Button>
  );
}

export function StaffForm() {
  const [state, formAction] = useActionState(createStaffAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.created) {
      formRef.current?.reset();
    }
  }, [state.created]);

  return (
    <form ref={formRef} action={formAction} className="space-y-5" noValidate>
      <div>
        <Label htmlFor="fullName">Nome e cognome</Label>
        <Input id="fullName" name="fullName" placeholder="Es. Maria Rossi" required />
      </div>
      <div>
        <Label htmlFor="username">Nome utente</Label>
        <Input id="username" name="username" placeholder="Es. mrossi" required />
      </div>
      <div>
        <Label htmlFor="temporaryPassword">Password temporanea</Label>
        <Input id="temporaryPassword" name="temporaryPassword" minLength={8} required />
        <FieldHint>
          Il nuovo admin dovrà cambiarla al primo accesso. Almeno 8 caratteri.
        </FieldHint>
      </div>

      {state.error && (
        <div className="rounded-xl bg-destructive/8 px-3.5 py-2.5">
          <FieldError>{state.error}</FieldError>
        </div>
      )}

      {state.created && (
        <div className="rounded-xl border border-[var(--color-u14)]/30 bg-[var(--color-u14-soft)] px-4 py-3 text-sm text-[var(--color-u14-strong)]">
          <p className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Account creato
          </p>
          <p className="mt-1.5">
            Comunica queste credenziali al nuovo admin, dovrà cambiare la password al primo accesso.
          </p>
          <p className="mt-2 rounded-lg bg-white/60 px-3 py-2 font-mono text-xs">
            Utente: <strong>{state.created.username}</strong>
            <br />
            Password: <strong>{state.created.password}</strong>
          </p>
        </div>
      )}

      <SubmitButton />
    </form>
  );
}
