"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea, FieldError, FieldHint, FormActions, Toggle } from "@/components/ui/Field";
import { createPlanAction, type PlanFormState } from "./actions";

const initialState: PlanFormState = {};

const EXAMPLE = `1. FOAM ROLL + ELASTICI – 10’

Solito lavoro di preparazione con foam roll, elastici e attivazione.

2. RISCALDAMENTO A COPPIE CON PALLA – 15’

Lavoro a coppie con:

* Palleggio
* Bagher frontale`;

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      <ClipboardList className="h-4 w-4" />
      {pending ? "Creazione…" : label}
    </Button>
  );
}

export function PlanCreateForm({
  occurrenceRuleId,
  occurrenceDate,
  defaultTitle,
}: {
  occurrenceRuleId?: string;
  occurrenceDate?: string;
  defaultTitle?: string;
}) {
  const [state, formAction] = useActionState(createPlanAction, initialState);
  const isForOccurrence = Boolean(occurrenceRuleId && occurrenceDate);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {isForOccurrence && (
        <>
          <input type="hidden" name="occurrenceRuleId" value={occurrenceRuleId} />
          <input type="hidden" name="occurrenceDate" value={occurrenceDate} />
          <Toggle
            name="isPublic"
            label="Visibile sul calendario pubblico"
            description="Genitori e atlete la vedono nei dettagli dell'allenamento."
          />
        </>
      )}

      <div>
        <Label htmlFor="title">Titolo scheda</Label>
        <Input
          id="title"
          name="title"
          placeholder="Es. Ricezione e sistema P3/P4"
          defaultValue={defaultTitle}
          required
        />
      </div>

      <div>
        <Label htmlFor="pastedText">Incolla il contenuto dell&apos;allenamento (opzionale)</Label>
        <Textarea
          id="pastedText"
          name="pastedText"
          rows={12}
          placeholder={EXAMPLE}
          className="bg-surface-muted font-mono text-[13px] leading-relaxed sm:text-xs"
        />
        <FieldHint>
          Ogni blocco inizia con una riga tipo &quot;1. TITOLO – 10&apos;&quot;: il testo viene diviso in
          blocchi, uno per intestazione, senza modificarne il contenuto. Lascia vuoto per una scheda
          senza blocchi.
        </FieldHint>
      </div>

      <Toggle
        name="useAi"
        label="Dividi con l'aiuto dell'IA"
        description="Consigliato per testi con formattazione irregolare. Senza questa opzione l'IA interviene solo se non viene riconosciuto nessun blocco."
      />

      <div>
        <Label htmlFor="notes">Note (opzionale)</Label>
        <Textarea id="notes" name="notes" placeholder="Es. Durata complessiva: 130 minuti." />
      </div>

      {state.error && (
        <div className="rounded-xl bg-destructive/8 px-3.5 py-2.5">
          <FieldError>{state.error}</FieldError>
        </div>
      )}

      <FormActions>
        <SubmitButton label={isForOccurrence ? "Crea e collega" : "Crea scheda"} />
      </FormActions>
    </form>
  );
}
