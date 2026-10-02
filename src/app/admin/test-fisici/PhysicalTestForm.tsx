"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea, FieldError, FieldHint } from "@/components/ui/Field";
import { savePhysicalTestAction, type PhysicalTestFormState } from "./actions";
import type { PhysicalTest } from "@/lib/types";

const initialState: PhysicalTestFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Save className="h-4 w-4" />
      {pending ? "Salvataggio…" : "Salva test"}
    </Button>
  );
}

export function PhysicalTestForm({
  athleteId,
  testNameSuggestions,
  test,
}: {
  athleteId: string;
  testNameSuggestions: string[];
  test?: PhysicalTest;
}) {
  const [state, formAction] = useActionState(savePhysicalTestAction, initialState);
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {test && <input type="hidden" name="id" value={test.id} />}
      <input type="hidden" name="athleteId" value={athleteId} />

      <div>
        <Label htmlFor="testName">Nome del test</Label>
        <Input
          id="testName"
          name="testName"
          list="test-name-suggestions"
          defaultValue={test?.testName}
          placeholder="Es. Altezza di salto"
          required
        />
        <datalist id="test-name-suggestions">
          {testNameSuggestions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <FieldHint>Riusa lo stesso nome per poter confrontare i risultati della stessa atleta nel tempo.</FieldHint>
      </div>

      <div>
        <Label htmlFor="value">Risultato</Label>
        <Input id="value" name="value" defaultValue={test?.value} placeholder="Es. 45 cm" required />
      </div>

      <div>
        <Label htmlFor="date">Data del test</Label>
        <Input id="date" name="date" type="date" defaultValue={test?.date ?? todayStr} required />
      </div>

      <div>
        <Label htmlFor="notes">Note (opzionale)</Label>
        <Textarea id="notes" name="notes" defaultValue={test?.notes ?? ""} rows={3} />
      </div>

      {state.error && (
        <div className="rounded-xl bg-destructive/8 px-3.5 py-2.5">
          <FieldError>{state.error}</FieldError>
        </div>
      )}

      <SubmitButton />
    </form>
  );
}
