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

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Puzzle className="h-4 w-4" />
      {pending ? "Creazione…" : "Crea scheda"}
    </Button>
  );
}

export function PlanCreateForm() {
  const [state, formAction] = useActionState(createPlanAction, initialState);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <div>
        <Label htmlFor="title">Titolo scheda</Label>
        <Input id="title" name="title" placeholder="Es. Ricezione e sistema P3/P4" required />
      </div>

      <div>
        <Label htmlFor="planDate">Data (opzionale)</Label>
        <Input id="planDate" name="planDate" type="date" />
      </div>

      <div>
        <Label htmlFor="pastedText">Incolla il contenuto dell&apos;allenamento (opzionale)</Label>
        <Textarea id="pastedText" name="pastedText" rows={12} placeholder={EXAMPLE} className="font-mono text-xs" />
        <FieldHint>
          Ogni blocco deve iniziare con una riga tipo &quot;1. TITOLO – 10&apos;&quot;. Il testo
          viene diviso automaticamente in macro blocchi riutilizzabili: se esiste già un blocco con
          lo stesso titolo viene riusato invece di duplicarlo. Lascia vuoto per creare una scheda
          vuota e comporla dopo con blocchi esistenti.
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

      <SubmitButton />
    </form>
  );
}
