"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, ListPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Label, Select, Textarea, FieldError, FieldHint } from "@/components/ui/Field";
import { CATEGORY_LABELS } from "@/lib/category";
import { bulkCreateAthletesAction, type BulkAthleteFormState } from "./actions";

const initialState: BulkAthleteFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <ListPlus className="h-4 w-4" />
      {pending ? "Creazione…" : "Aggiungi elenco"}
    </Button>
  );
}

export function BulkAthleteForm() {
  const [state, formAction] = useActionState(bulkCreateAthletesAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.created) {
      formRef.current?.reset();
    }
  }, [state.created]);

  return (
    <form ref={formRef} action={formAction} className="space-y-5" noValidate>
      <div>
        <Label htmlFor="names">Nominativi</Label>
        <Textarea
          id="names"
          name="names"
          rows={8}
          placeholder={"Giulia Bianchi\nSara Rossi\nMarta Verdi"}
          required
        />
        <FieldHint>Un nome per riga. Verranno create tutte insieme.</FieldHint>
      </div>

      <div>
        <Label htmlFor="bulk-category">Categoria (opzionale, per tutte)</Label>
        <Select id="bulk-category" name="category" defaultValue="">
          <option value="">Nessuna categoria</option>
          <option value="U14">{CATEGORY_LABELS.U14}</option>
          <option value="U15">{CATEGORY_LABELS.U15}</option>
        </Select>
        <FieldHint>
          Potrai assegnare o correggere la categoria di ciascuna atleta in un secondo momento.
        </FieldHint>
      </div>

      {state.error && (
        <div className="rounded-xl bg-destructive/8 px-3.5 py-2.5">
          <FieldError>{state.error}</FieldError>
        </div>
      )}

      {state.created !== undefined && (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--color-u14)]/30 bg-[var(--color-u14-soft)] px-4 py-3 text-sm font-medium text-[var(--color-u14-strong)]">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {state.created} {state.created === 1 ? "atleta aggiunta" : "atlete aggiunte"}.
        </div>
      )}

      <SubmitButton />
    </form>
  );
}
