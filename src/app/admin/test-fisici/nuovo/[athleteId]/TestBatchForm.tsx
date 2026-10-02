"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowUpToLine, Calendar, Plus, PersonStanding, Ruler, Save, Scale, Timer, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea, Label, FieldError, FieldHint } from "@/components/ui/Field";
import { PillInput } from "../../PillInput";
import { MetricRow, RowGroup } from "../../MetricRow";
import { saveTestBatchAction, type PhysicalTestBatchFormState } from "../../actions";
import { BODY_MEASURE_FIELDS, SQUAT_JUMP_TRIALS } from "@/lib/physicalTestFields";

const initialState: PhysicalTestBatchFormState = {};

const BODY_MEASURE_ICONS = { peso: Scale, gamba90: Ruler, gambaEstesa: PersonStanding } as const;
const BODY_MEASURE_PLACEHOLDERS = { peso: "53", gamba90: "52", gambaEstesa: "91" } as const;
const TRIALS = Array.from({ length: SQUAT_JUMP_TRIALS }, (_, i) => i + 1);

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

/** Ordine d'inserimento calcato sull'app di riferimento usata finora dallo
 * staff: prima i dati di profilo (peso, gambe), poi lo Squat Jump
 * raggruppato per metrica (prima tutte le Altezze dei 3 salti, poi tutti i
 * Tempi di volo, poi tutte le Forze) invece che per salto — stesso ordine
 * con cui lo staff sfoglia le schermate "Editar perfil" → "Jump Height" →
 * "Flight Time" sull'altra app. */
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
    <form action={formAction} className="space-y-7" noValidate>
      <input type="hidden" name="athleteId" value={athleteId} />

      <div>
        <Label htmlFor="date">Data della sessione</Label>
        <PillInput id="date" name="date" type="date" icon={Calendar} defaultValue={todayStr} required />
        <FieldHint>Vale per tutti i dati inseriti qui sotto.</FieldHint>
      </div>

      <div>
        <p className="font-display text-sm font-bold text-foreground">Misure corporee</p>
        <RowGroup className="mt-3">
          {BODY_MEASURE_FIELDS.map((field) => (
            <MetricRow
              key={field.key}
              id={field.key}
              name={field.key}
              type="number"
              step="any"
              inputMode="decimal"
              icon={BODY_MEASURE_ICONS[field.key]}
              label={field.label}
              unit={field.unit}
              defaultValue={bodyMeasurePrefill[field.key] ?? ""}
              placeholder={BODY_MEASURE_PLACEHOLDERS[field.key]}
              aria-label={`${field.label} in ${field.unit}`}
            />
          ))}
        </RowGroup>
      </div>

      <div>
        <p className="font-display text-sm font-bold text-foreground">Squat Jump</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Fino a {SQUAT_JUMP_TRIALS} salti: lascia vuoto un salto non eseguito.
        </p>

        <p className="eyebrow mt-4 text-foreground/50">Altezza (cm)</p>
        <RowGroup className="mt-2">
          {TRIALS.map((trial) => (
            <MetricRow
              key={trial}
              name={`squatJump_${trial}_altezza`}
              type="number"
              step="any"
              inputMode="decimal"
              icon={ArrowUpToLine}
              label={`Salto ${trial}`}
              unit="cm"
              aria-label={`Salto ${trial}, altezza in centimetri`}
            />
          ))}
        </RowGroup>

        <p className="eyebrow mt-4 text-foreground/50">Tempo di volo (ms)</p>
        <RowGroup className="mt-2">
          {TRIALS.map((trial) => (
            <MetricRow
              key={trial}
              name={`squatJump_${trial}_tempo`}
              type="number"
              step="any"
              inputMode="decimal"
              icon={Timer}
              label={`Salto ${trial}`}
              unit="ms"
              aria-label={`Salto ${trial}, tempo di volo in millisecondi`}
            />
          ))}
        </RowGroup>

        <p className="eyebrow mt-4 text-foreground/50">Forza (N)</p>
        <RowGroup className="mt-2">
          {TRIALS.map((trial) => (
            <MetricRow
              key={trial}
              name={`squatJump_${trial}_forza`}
              type="number"
              step="any"
              inputMode="decimal"
              icon={Zap}
              label={`Salto ${trial}`}
              unit="N"
              aria-label={`Salto ${trial}, forza in newton`}
            />
          ))}
        </RowGroup>
      </div>

      <div>
        <p className="font-display text-sm font-bold text-foreground">Altro</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Qualunque altro dato non previsto sopra.</p>
        <RowGroup className="mt-3">
          {altroRows.map((rowId) => (
            <div key={rowId} className="flex items-center gap-2 px-4 py-2.5 sm:px-5">
              <input
                name="altroName"
                list="test-name-suggestions"
                placeholder="Nome del dato"
                aria-label="Nome del dato"
                className="min-w-0 flex-1 rounded-lg border-0 bg-transparent py-1 text-sm text-foreground placeholder:text-foreground/35 focus:bg-primary/6 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <input
                name="altroValue"
                placeholder="Valore"
                aria-label="Valore"
                className="w-24 shrink-0 rounded-lg border-0 bg-transparent py-1 text-right text-sm font-semibold text-foreground placeholder:text-foreground/25 placeholder:font-normal focus:bg-primary/6 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="button"
                aria-label="Rimuovi riga"
                onClick={() => setAltroRows((rows) => rows.filter((id) => id !== rowId))}
                className="shrink-0 rounded-full p-1.5 text-foreground/40 hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <div className="px-4 py-2.5 sm:px-5">
            <datalist id="test-name-suggestions">
              {testNameSuggestions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-3.5"
              onClick={() => setAltroRows((rows) => [...rows, nextAltroRowId()])}
            >
              <Plus className="h-3.5 w-3.5" />
              Aggiungi riga
            </Button>
          </div>
        </RowGroup>
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
