"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowUpToLine, Calendar, Plus, PersonStanding, Ruler, Save, Scale, Timer, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea, Label, FieldError, FieldHint } from "@/components/ui/Field";
import { PillInput } from "../../PillInput";
import { saveTestBatchAction, type PhysicalTestBatchFormState } from "../../actions";
import { BODY_MEASURE_FIELDS, SQUAT_JUMP_TRIALS } from "@/lib/physicalTestFields";

const initialState: PhysicalTestBatchFormState = {};

const BODY_MEASURE_ICONS = { peso: Scale, gamba90: Ruler, gambaEstesa: PersonStanding } as const;
const BODY_MEASURE_PLACEHOLDERS = { peso: "53", gamba90: "52", gambaEstesa: "91" } as const;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
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

/** Form d'inserimento a pillole impilate (una per campo, icona a sinistra),
 * nello stesso ordine e con lo stesso linguaggio visivo delle schermate
 * dell'app di riferimento usata finora dallo staff (fin qui: "Editar
 * perfil" per peso/gambe, "Summary" per lo Squat Jump) — qui con i colori
 * del design system del sito invece del tema scuro originale. */
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
        <PillInput id="date" name="date" type="date" icon={Calendar} defaultValue={todayStr} required />
        <FieldHint>Vale per tutti i dati inseriti qui sotto.</FieldHint>
      </div>

      <div>
        <p className="font-display text-sm font-bold text-foreground">Squat Jump</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Fino a {SQUAT_JUMP_TRIALS} salti: lascia vuoto un salto non eseguito.
        </p>
        <div className="mt-4 space-y-5">
          {Array.from({ length: SQUAT_JUMP_TRIALS }, (_, i) => i + 1).map((trial) => (
            <div key={trial}>
              <p className="eyebrow text-foreground/50">Salto {trial}</p>
              <div className="mt-2 space-y-2">
                <PillInput
                  name={`squatJump_${trial}_tempo`}
                  type="number"
                  step="any"
                  inputMode="decimal"
                  icon={Timer}
                  placeholder="Tempo di volo (ms)"
                  aria-label={`Salto ${trial}, tempo di volo in millisecondi`}
                />
                <PillInput
                  name={`squatJump_${trial}_altezza`}
                  type="number"
                  step="any"
                  inputMode="decimal"
                  icon={ArrowUpToLine}
                  placeholder="Altezza (cm)"
                  aria-label={`Salto ${trial}, altezza in centimetri`}
                />
                <PillInput
                  name={`squatJump_${trial}_forza`}
                  type="number"
                  step="any"
                  inputMode="decimal"
                  icon={Zap}
                  placeholder="Forza (N)"
                  aria-label={`Salto ${trial}, forza in newton`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="font-display text-sm font-bold text-foreground">Misure corporee</p>
        <div className="mt-3 space-y-2">
          {BODY_MEASURE_FIELDS.map((field) => (
            <PillInput
              key={field.key}
              id={field.key}
              name={field.key}
              type="number"
              step="any"
              inputMode="decimal"
              icon={BODY_MEASURE_ICONS[field.key]}
              defaultValue={bodyMeasurePrefill[field.key] ?? ""}
              placeholder={`${field.label} (${field.unit}) · es. ${BODY_MEASURE_PLACEHOLDERS[field.key]}`}
              aria-label={`${field.label} in ${field.unit}`}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="font-display text-sm font-bold text-foreground">Altro</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Qualunque altro dato non previsto sopra.</p>
        <div className="mt-3 space-y-2.5">
          {altroRows.map((rowId) => (
            <div key={rowId} className="flex items-center gap-2">
              <div className="flex-1">
                <PillInput
                  name="altroName"
                  list="test-name-suggestions"
                  placeholder="Nome del dato"
                  aria-label="Nome del dato"
                />
              </div>
              <div className="flex-1">
                <PillInput name="altroValue" placeholder="Valore" aria-label="Valore" />
              </div>
              <button
                type="button"
                aria-label="Rimuovi riga"
                onClick={() => setAltroRows((rows) => rows.filter((id) => id !== rowId))}
                className="shrink-0 rounded-full p-2 text-foreground/40 hover:bg-muted hover:text-foreground"
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
