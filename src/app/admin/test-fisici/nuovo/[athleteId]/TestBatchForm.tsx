"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Save, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea, FieldError, FieldHint } from "@/components/ui/Field";
import { saveTestBatchAction, type PhysicalTestBatchFormState } from "../../actions";
import { BODY_MEASURE_FIELDS, SQUAT_JUMP_TRIALS } from "@/lib/physicalTestFields";

const initialState: PhysicalTestBatchFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Save className="h-4 w-4" />
      {pending ? "Salvataggio…" : "Salva test"}
    </Button>
  );
}

let altroRowId = 0;
function nextAltroRowId() {
  altroRowId += 1;
  return altroRowId;
}

export function TestBatchForm({
  athleteId,
  testNameSuggestions,
  bodyMeasurePrefill,
}: {
  athleteId: string;
  testNameSuggestions: string[];
  bodyMeasurePrefill: Record<string, string>;
}) {
  const [state, formAction] = useActionState(saveTestBatchAction, initialState);
  const [altroRows, setAltroRows] = useState<number[]>(() => [nextAltroRowId()]);
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-8" noValidate>
      <input type="hidden" name="athleteId" value={athleteId} />

      <div>
        <Label htmlFor="date">Data della sessione</Label>
        <Input id="date" name="date" type="date" defaultValue={todayStr} required />
        <FieldHint>Vale per tutti i dati inseriti qui sotto.</FieldHint>
      </div>

      <div>
        <p className="font-display text-sm font-bold text-foreground">Squat Jump</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Fino a {SQUAT_JUMP_TRIALS} salti: lascia vuoto un salto non eseguito.
        </p>
        <div className="mt-3 space-y-3">
          {Array.from({ length: SQUAT_JUMP_TRIALS }, (_, i) => i + 1).map((trial) => (
            <div key={trial} className="grid grid-cols-[auto_1fr_1fr] items-center gap-2.5 sm:gap-3">
              <span className="text-sm font-semibold text-foreground/70">Salto {trial}</span>
              <div>
                <Input
                  name={`squatJump_${trial}_tempo`}
                  type="number"
                  step="any"
                  inputMode="decimal"
                  placeholder="Tempo (s)"
                  aria-label={`Salto ${trial}, tempo di volo in secondi`}
                />
              </div>
              <div>
                <Input
                  name={`squatJump_${trial}_altezza`}
                  type="number"
                  step="any"
                  inputMode="decimal"
                  placeholder="Altezza (cm)"
                  aria-label={`Salto ${trial}, altezza in centimetri`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="font-display text-sm font-bold text-foreground">Misure corporee</p>
        <div className="mt-3 space-y-4">
          {BODY_MEASURE_FIELDS.map((field) => (
            <div key={field.key}>
              <Label htmlFor={field.key}>
                {field.label} ({field.unit})
              </Label>
              <Input
                id={field.key}
                name={field.key}
                type="number"
                step="any"
                inputMode="decimal"
                defaultValue={bodyMeasurePrefill[field.key] ?? ""}
                placeholder={`Es. ${field.key === "peso" ? "53" : field.key === "gamba90" ? "52" : "91"}`}
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="font-display text-sm font-bold text-foreground">Altro</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Qualunque altro dato non previsto sopra.</p>
        <div className="mt-3 space-y-2.5">
          {altroRows.map((rowId) => (
            <div key={rowId} className="flex items-start gap-2">
              <div className="flex-1">
                <Input
                  name="altroName"
                  list="test-name-suggestions"
                  placeholder="Nome del dato"
                  aria-label="Nome del dato"
                />
              </div>
              <div className="flex-1">
                <Input name="altroValue" placeholder="Valore" aria-label="Valore" />
              </div>
              <button
                type="button"
                aria-label="Rimuovi riga"
                onClick={() => setAltroRows((rows) => rows.filter((id) => id !== rowId))}
                className="mt-0.5 shrink-0 rounded-full p-2 text-foreground/40 hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <datalist id="test-name-suggestions">
            {testNameSuggestions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setAltroRows((rows) => [...rows, nextAltroRowId()])}
          >
            <Plus className="h-3.5 w-3.5" />
            Aggiungi riga
          </Button>
        </div>
      </div>

      <div>
        <Label htmlFor="notes">Note (opzionale)</Label>
        <Textarea id="notes" name="notes" rows={3} />
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
