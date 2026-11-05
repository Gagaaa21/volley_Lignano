"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, KeyRound, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CopyTextButton } from "@/components/ui/CopyTextButton";
import { EXACT_TEXT, Input, Label, FieldError, FieldHint, Toggle, FormActions } from "@/components/ui/Field";
import { credentialsText } from "./credentials";
import { updateStaffAction, type UpdateStaffFormState } from "./actions";
import type { StaffMember } from "@/lib/types";

const initialState: UpdateStaffFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
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
        <Input id="username" name="username" defaultValue={member.username} autoComplete="off" {...EXACT_TEXT} required />
      </div>
      <div>
        <Label htmlFor="newPassword" className="flex items-center gap-1.5">
          <KeyRound className="h-3.5 w-3.5" />
          Nuova password temporanea (opzionale)
        </Label>
        <Input
          id="newPassword"
          name="newPassword"
          minLength={8}
          placeholder="Lascia vuoto per non cambiarla"
          autoComplete="off"
          {...EXACT_TEXT}
        />
        <FieldHint>
          Se la imposti, entrerà con questa e subito dopo ne sceglierà una sua. Almeno 8 caratteri; maiuscole e minuscole contano.
        </FieldHint>
      </div>

      <Toggle
        name="hiddenFromAdmins"
        defaultChecked={member.hiddenFromAdmins}
        label="Nascondi agli altri admin"
        description="Sparisce dall'elenco Staff visto da altri account Admin. Tu (Developer) lo vedi comunque sempre."
      />

      {state.error && (
        <div className="rounded-xl bg-destructive/8 px-3.5 py-2.5">
          <FieldError>{state.error}</FieldError>
        </div>
      )}

      {state.saved && (
        <div className="rounded-xl border border-success/20 bg-success-soft px-4 py-3 text-sm text-success">
          <p className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Modifiche salvate
          </p>
          {state.resetPassword && (
            <>
              <p className="mt-2 rounded-lg bg-card/60 px-3 py-2 font-mono text-xs" data-staff-credentials>
                Utente: <strong>{state.resetPassword.username}</strong>
                <br />
                Nuova password: <strong>{state.resetPassword.password}</strong>
              </p>
              <p className="mt-2 text-xs leading-relaxed text-foreground/75">
                Mandale esattamente così. Entra con queste e subito dopo sceglie una password sua. Se il telefono gli propone
                la vecchia password, la cancella e scrive questa.
              </p>
              <div className="mt-2">
                <CopyTextButton text={credentialsText(state.resetPassword)} data-staff-credentials-copy>
                  Copia per mandarle
                </CopyTextButton>
              </div>
            </>
          )}
        </div>
      )}

      <FormActions>
        <SubmitButton />
      </FormActions>
    </form>
  );
}
