"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea, FieldError, FormActions, Toggle } from "@/components/ui/Field";
import { CATEGORY_LABELS, MINIVOLLEY_GROUP_LABELS } from "@/lib/category";
import { saveAthleteAction, type AthleteFormState } from "./actions";
import type { Athlete, TrainingTeam } from "@/lib/types";

const initialState: AthleteFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      <Save className="h-4 w-4" />
      {pending ? "Salvataggio…" : "Salva atleta"}
    </Button>
  );
}

export function AthleteForm({ athlete, team }: { athlete?: Athlete; team: TrainingTeam }) {
  const [state, formAction] = useActionState(saveAthleteAction, initialState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {athlete && <input type="hidden" name="id" value={athlete.id} />}

      <div>
        <Label htmlFor="fullName">Nome e cognome</Label>
        <Input id="fullName" name="fullName" defaultValue={athlete?.fullName} placeholder="Es. Giulia Bianchi" required />
      </div>

      {team === "u14u15" ? (
        <div className="sm:max-w-xs">
          <Label htmlFor="category">Categoria (opzionale)</Label>
          <Select id="category" name="category" defaultValue={athlete?.category ?? ""}>
            <option value="">Nessuna categoria</option>
            <option value="U14">{CATEGORY_LABELS.U14}</option>
            <option value="U15">{CATEGORY_LABELS.U15}</option>
          </Select>
        </div>
      ) : (
        <div className="sm:max-w-xs">
          <Label htmlFor="group">Gruppo (opzionale)</Label>
          <Select id="group" name="group" defaultValue={athlete?.group ?? ""}>
            <option value="">Nessun gruppo</option>
            <option value="lignano">{MINIVOLLEY_GROUP_LABELS.lignano}</option>
            <option value="san_michele">{MINIVOLLEY_GROUP_LABELS.san_michele}</option>
          </Select>
        </div>
      )}

      <div>
        <Label htmlFor="notes">Note (opzionale)</Label>
        <Textarea id="notes" name="notes" defaultValue={athlete?.notes ?? ""} rows={3} />
      </div>

      <Toggle
        name="isActive"
        label="Atleta attiva"
        description="Compare nel registro presenze."
        defaultChecked={athlete?.isActive ?? true}
      />

      {state.error && (
        <div className="rounded-xl bg-destructive/8 px-3.5 py-2.5">
          <FieldError>{state.error}</FieldError>
        </div>
      )}

      <FormActions>
        <SubmitButton />
      </FormActions>
    </form>
  );
}
