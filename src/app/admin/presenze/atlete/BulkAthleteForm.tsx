"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, ListPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Label, Select, Textarea, FieldError, FieldHint, FormActions } from "@/components/ui/Field";
import { CATEGORY_LABELS } from "@/lib/category";
import { bulkCreateAthletesAction, type BulkAthleteFormState } from "./actions";
import type { TrainingTeam } from "@/lib/types";

const initialState: BulkAthleteFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      <ListPlus className="h-4 w-4" />
      {pending ? "Creazione…" : "Aggiungi elenco"}
    </Button>
  );
}

export function BulkAthleteForm({ team }: { team: TrainingTeam }) {
  const [state, formAction] = useActionState(bulkCreateAthletesAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const isMini = team === "minivolley";

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
          className="bg-surface-muted font-mono text-[13px] leading-relaxed sm:text-xs"
          placeholder={isMini ? "Lignano Sabbiadoro   Giulia   Bianchi" : "Giulia Bianchi\nSara Rossi\nMarta Verdi"}
          required
        />
        {isMini ? (
          <FieldHint>
            Un&apos;atleta per riga, tre campi separati da tabulazione (come quando si incolla da un foglio di
            calcolo): gruppo, nome, cognome — es. &quot;Lignano Sabbiadoro&quot; o &quot;San Michele al
            Tagliamento&quot; per il gruppo. Verranno create tutte insieme.
          </FieldHint>
        ) : (
          <FieldHint>Un nome per riga. Verranno create tutte insieme.</FieldHint>
        )}
      </div>

      {!isMini && (
        <div className="sm:max-w-xs">
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
      )}

      {state.error && (
        <div className="rounded-xl bg-destructive/8 px-3.5 py-2.5">
          <FieldError>{state.error}</FieldError>
        </div>
      )}

      {state.created !== undefined && (
        <div className="flex items-center gap-2 rounded-xl border border-success/20 bg-success-soft px-4 py-3 text-sm font-medium text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {state.created} {state.created === 1 ? "atleta aggiunta" : "atlete aggiunte"}
          {!!state.skipped && `, ${state.skipped} già ${state.skipped === 1 ? "esistente" : "esistenti"} (${state.skipped === 1 ? "saltata" : "saltate"})`}
          .
        </div>
      )}

      <FormActions>
        <SubmitButton />
      </FormActions>
    </form>
  );
}
