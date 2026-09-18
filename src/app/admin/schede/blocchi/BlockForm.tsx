"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea, FieldError, FieldHint } from "@/components/ui/Field";
import { saveBlockAction, type BlockFormState } from "./actions";
import type { TrainingBlock } from "@/lib/types";

const initialState: BlockFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Save className="h-4 w-4" />
      {pending ? "Salvataggio…" : "Salva blocco"}
    </Button>
  );
}

export function BlockForm({ block, planId }: { block?: TrainingBlock; planId?: string }) {
  const [state, formAction] = useActionState(saveBlockAction, initialState);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {block && <input type="hidden" name="id" value={block.id} />}
      {planId && <input type="hidden" name="planId" value={planId} />}

      <div>
        <Label htmlFor="title">Titolo del blocco</Label>
        <Input
          id="title"
          name="title"
          defaultValue={block?.title}
          placeholder="Es. Riscaldamento a coppie con palla"
          required
        />
      </div>

      <div>
        <Label htmlFor="durationMinutes">Durata (minuti)</Label>
        <Input
          id="durationMinutes"
          name="durationMinutes"
          type="number"
          min={1}
          max={600}
          defaultValue={block?.durationMinutes}
          required
        />
      </div>

      <div>
        <Label htmlFor="content">Descrizione / svolgimento</Label>
        <Textarea
          id="content"
          name="content"
          rows={10}
          defaultValue={block?.content}
          placeholder={"Lavoro a coppie con:\n\n* Palleggio\n* Bagher frontale\n\nProgressione dell'intensità..."}
        />
        <FieldHint>
          Righe che iniziano con &quot;*&quot; o &quot;-&quot; diventano un elenco puntato, righe
          numerate (&quot;1. …&quot;) diventano un elenco numerato. Riga vuota = nuovo paragrafo.
        </FieldHint>
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
