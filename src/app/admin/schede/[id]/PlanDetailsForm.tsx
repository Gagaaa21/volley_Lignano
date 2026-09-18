"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea, FieldError } from "@/components/ui/Field";
import { updatePlanDetailsAction, type PlanFormState } from "../actions";
import type { TrainingPlan } from "@/lib/types";

const initialState: PlanFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      <Save className="h-3.5 w-3.5" />
      {pending ? "Salvataggio…" : "Salva dettagli"}
    </Button>
  );
}

export function PlanDetailsForm({ plan }: { plan: TrainingPlan }) {
  const [state, formAction] = useActionState(updatePlanDetailsAction, initialState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="id" value={plan.id} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="title">Titolo</Label>
          <Input id="title" name="title" defaultValue={plan.title} required />
        </div>
        <div>
          <Label htmlFor="planDate">Data (opzionale)</Label>
          <Input id="planDate" name="planDate" type="date" defaultValue={plan.planDate ?? ""} />
        </div>
      </div>

      <div>
        <Label htmlFor="notes">Note</Label>
        <Textarea id="notes" name="notes" defaultValue={plan.notes ?? ""} rows={2} />
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
