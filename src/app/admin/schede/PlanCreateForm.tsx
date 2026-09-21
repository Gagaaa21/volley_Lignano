"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Clock, Puzzle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea, FieldError, FieldHint } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { createPlanAction, type PlanFormState } from "./actions";
import type { TrainingBlock } from "@/lib/types";

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
  blocks = [],
  occurrenceRuleId,
  occurrenceDate,
  defaultTitle,
}: {
  blocks?: TrainingBlock[];
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
        <Label htmlFor="planDate">Data (opzionale)</Label>
        <Input id="planDate" name="planDate" type="date" defaultValue={occurrenceDate} />
      </div>

      {blocks.length > 0 && (
        <div>
          <Label>Blocchi dalla libreria (opzionale)</Label>
          <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-xl border border-border-subtle bg-surface p-2">
            {blocks.map((block) => (
              <label
                key={block.id}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors has-[:checked]:bg-primary/8"
              >
                <input
                  type="checkbox"
                  name="blockIds"
                  value={block.id}
                  className="h-4 w-4 shrink-0 rounded border-border-subtle accent-sea-700 focus:ring-sea-500"
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground/85">
                  {block.title}
                </span>
                <span
                  className={cn(
                    "flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-[var(--color-training-strong)]",
                    "bg-[var(--color-training-soft)]",
                  )}
                >
                  <Clock className="h-2.5 w-2.5" />
                  {block.durationMinutes}&apos;
                </span>
              </label>
            ))}
          </div>
          <FieldHint>
            Riusa blocchi già pronti: verranno aggiunti in cima alla scheda, prima di quelli incollati
            qui sotto.
          </FieldHint>
        </div>
      )}

      <div>
        <Label htmlFor="pastedText">Incolla il contenuto dell&apos;allenamento (opzionale)</Label>
        <Textarea id="pastedText" name="pastedText" rows={12} placeholder={EXAMPLE} className="font-mono text-xs" />
        <FieldHint>
          Ogni blocco deve iniziare con una riga tipo &quot;1. TITOLO – 10&apos;&quot;. Il testo
          viene diviso automaticamente in macro blocchi riutilizzabili: se esiste già un blocco con
          lo stesso titolo viene riusato invece di duplicarlo. Lascia vuoto per creare una scheda
          vuota e comporla dopo con blocchi esistenti.
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
        <div className="rounded-xl bg-red-50 px-3.5 py-2.5">
          <FieldError>{state.error}</FieldError>
        </div>
      )}

      <SubmitButton label={isForOccurrence ? "Crea e collega" : "Crea scheda"} />
    </form>
  );
}
