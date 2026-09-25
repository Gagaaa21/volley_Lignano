"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Puzzle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea, FieldError, FieldHint } from "@/components/ui/Field";
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
    <Button type="submit" disabled={pending}>
      <Puzzle className="h-4 w-4" />
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
    <form action={formAction} className="space-y-6" noValidate>
      {isForOccurrence && (
        <>
          <input type="hidden" name="occurrenceRuleId" value={occurrenceRuleId} />
          <input type="hidden" name="occurrenceDate" value={occurrenceDate} />
          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border-subtle bg-surface-muted/60 px-3.5 py-3 text-sm font-medium text-foreground/85">
            <input
              type="checkbox"
              name="isPublic"
              className="h-4 w-4 shrink-0 rounded border-border-subtle accent-sea-700 focus:ring-sea-500"
            />
            Visibile sul calendario pubblico (genitori e atlete)
          </label>
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
        <Textarea id="pastedText" name="pastedText" rows={12} placeholder={EXAMPLE} className="font-mono text-xs" />
        <FieldHint>
          Ogni blocco deve iniziare con una riga tipo &quot;1. TITOLO – 10&apos;&quot;. Il testo
          viene diviso automaticamente in blocchi, uno per intestazione: il contenuto resta
          esattamente come scritto, senza modifiche. Lascia vuoto per creare una scheda senza
          blocchi.
        </FieldHint>
        <label className="mt-2.5 flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1.5">
          <input
            type="checkbox"
            name="useAi"
            className="h-4 w-4 shrink-0 rounded border-border-subtle accent-sea-700 focus:ring-sea-500"
          />
          <span className="text-sm font-medium text-foreground/85">
            Dividi con l&apos;aiuto dell&apos;IA
          </span>
        </label>
        <FieldHint>
          Consigliato per testi con formattazione irregolare. Se non selezionato, l&apos;IA viene
          comunque usata automaticamente come ripiego solo se il riconoscimento automatico non
          trova nessun blocco.
        </FieldHint>
      </div>

      <div>
        <Label htmlFor="notes">Note (opzionale)</Label>
        <Textarea id="notes" name="notes" placeholder="Es. Durata complessiva: 130 minuti." />
      </div>

      {state.error && (
        <div className="rounded-xl bg-destructive/8 px-3.5 py-2.5">
          <FieldError>{state.error}</FieldError>
        </div>
      )}

      <SubmitButton label={isForOccurrence ? "Crea e collega" : "Crea scheda"} />
    </form>
  );
}
