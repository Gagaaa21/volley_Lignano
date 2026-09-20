"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui/Field";
import { CATEGORY_LABELS } from "@/lib/category";
import { saveAthleteAction, type AthleteFormState } from "./actions";
import type { Athlete } from "@/lib/types";

const initialState: AthleteFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Save className="h-4 w-4" />
      {pending ? "Salvataggio…" : "Salva atleta"}
    </Button>
  );
}

export function AthleteForm({ athlete }: { athlete?: Athlete }) {
  const [state, formAction] = useActionState(saveAthleteAction, initialState);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {athlete && <input type="hidden" name="id" value={athlete.id} />}

      <div>
        <Label htmlFor="fullName">Nome e cognome</Label>
        <Input id="fullName" name="fullName" defaultValue={athlete?.fullName} placeholder="Es. Giulia Bianchi" required />
      </div>

      <div>
        <Label htmlFor="category">Categoria</Label>
        <Select id="category" name="category" defaultValue={athlete?.category ?? "U14"} required>
          <option value="U14">{CATEGORY_LABELS.U14}</option>
          <option value="U15">{CATEGORY_LABELS.U15}</option>
        </Select>
      </div>

      <div>
        <Label htmlFor="notes">Note (opzionale)</Label>
        <Textarea id="notes" name="notes" defaultValue={athlete?.notes ?? ""} rows={3} />
      </div>

      <label className="flex items-center gap-2.5 text-sm font-medium text-foreground/80">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={athlete?.isActive ?? true}
          className="h-4 w-4 rounded border-border-subtle accent-primary focus:ring-primary"
        />
        Atleta attiva (compare nella lista presenze)
      </label>

      {state.error && (
        <div className="rounded-xl bg-destructive/8 px-3.5 py-2.5">
          <FieldError>{state.error}</FieldError>
        </div>
      )}

      <SubmitButton />
    </form>
  );
}
