"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, CheckCircle2, ListPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Label, Select, Textarea, FieldError, FieldHint, FormActions } from "@/components/ui/Field";
import { CATEGORY_LABELS } from "@/lib/category";
import { nameKey, parseAthleteBulkLine } from "@/lib/jersey";
import { bulkCreateAthletesAction, type BulkAthleteFormState } from "./actions";
import type { TrainingTeam } from "@/lib/types";

const initialState: BulkAthleteFormState = {};
/** Quante atlete mostrare nell'anteprima prima del «…e altre». */
const PREVIEW_LIMIT = 14;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      <ListPlus className="h-4 w-4" />
      {pending ? "Creazione…" : "Aggiungi elenco"}
    </Button>
  );
}

/** Come verranno lette le righe scritte: nome e numero di maglia, prima di salvare. */
function readLines(text: string) {
  const seen = new Set<string>();
  const rows: { fullName: string; jerseyNumber: number | null }[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const row = parseAthleteBulkLine(line);
    if (!/\p{L}/u.test(row.fullName)) continue;
    const key = nameKey(row.fullName);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }
  return rows;
}

export function BulkAthleteForm({ team }: { team: TrainingTeam }) {
  const [state, formAction] = useActionState(bulkCreateAthletesAction, initialState);
  const [text, setText] = useState("");
  const [seenState, setSeenState] = useState(state);
  const isMini = team === "minivolley";

  // A elenco salvato la casella si svuota (e l'anteprima con lei).
  if (state !== seenState) {
    setSeenState(state);
    if (state.created !== undefined) setText("");
  }

  const rows = isMini ? [] : readLines(text);
  const withNumber = rows.filter((row) => row.jerseyNumber !== null).length;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <div>
        <Label htmlFor="names">Nominativi</Label>
        <Textarea
          id="names"
          name="names"
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="bg-surface-muted font-mono text-[13px] leading-relaxed sm:text-xs"
          placeholder={isMini ? "Lignano Sabbiadoro   Giulia   Bianchi" : "7 Giulia Bianchi\n10 Sara Rossi\nMarta Verdi"}
          required
        />
        {isMini ? (
          <FieldHint>
            Un&apos;atleta per riga, tre campi separati da tabulazione (come quando si incolla da un foglio di
            calcolo): gruppo, nome, cognome — es. &quot;Lignano Sabbiadoro&quot; o &quot;San Michele al
            Tagliamento&quot; per il gruppo. Verranno create tutte insieme.
          </FieldHint>
        ) : (
          <FieldHint>
            Un nome per riga. Se vuoi, scrivi anche il numero di maglia, prima o dopo il nome:{" "}
            <b className="font-semibold text-foreground/80">7 Giulia Bianchi</b> oppure{" "}
            <b className="font-semibold text-foreground/80">Giulia Bianchi 7</b>. Verranno create tutte insieme; chi c&apos;è già
            non viene duplicata, ma se scrivi un numero diverso quello si aggiorna.
          </FieldHint>
        )}
      </div>

      {!isMini && rows.length > 0 && (
        <div className="rounded-xl border border-border-subtle bg-surface-muted/60 px-3.5 py-3" data-bulk-preview>
          <p className="text-[13px] font-semibold text-foreground">
            {rows.length} {rows.length === 1 ? "atleta letta" : "atlete lette"}
            <span className="font-normal text-muted-foreground">
              {withNumber > 0 ? ` · ${withNumber} con il numero di maglia` : " · nessun numero di maglia"}
            </span>
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Anteprima delle atlete lette">
            {rows.slice(0, PREVIEW_LIMIT).map((row) => (
              <li
                key={nameKey(row.fullName)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface py-0.5 pl-1 pr-2.5 text-xs font-semibold text-foreground"
              >
                <span
                  className={
                    row.jerseyNumber === null
                      ? "grid h-5 min-w-5 place-items-center rounded-full bg-muted px-1 text-[10px] font-bold text-muted-foreground"
                      : "grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold tabular-nums text-primary-foreground"
                  }
                >
                  {row.jerseyNumber ?? "–"}
                </span>
                {row.fullName}
              </li>
            ))}
            {rows.length > PREVIEW_LIMIT && (
              <li className="inline-flex items-center px-1.5 text-xs text-muted-foreground">…e altre {rows.length - PREVIEW_LIMIT}</li>
            )}
          </ul>
        </div>
      )}

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
          <span>
            {state.created} {state.created === 1 ? "atleta aggiunta" : "atlete aggiunte"}
            {!!state.skipped && `, ${state.skipped} già ${state.skipped === 1 ? "esistente" : "esistenti"} (${state.skipped === 1 ? "saltata" : "saltate"})`}
            {!!state.numbersUpdated &&
              `; ${state.numbersUpdated === 1 ? "numero di maglia aggiornato per 1 atleta" : `numeri di maglia aggiornati per ${state.numbersUpdated} atlete`}`}
            .
          </span>
        </div>
      )}

      {state.numbersLost && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>
            Le atlete sono state salvate, ma i numeri di maglia no: nel database manca ancora la colonna. Serve il passaggio SQL
            indicato negli aggiornamenti; dopo basta incollare di nuovo l&apos;elenco con i numeri.
          </span>
        </div>
      )}

      <FormActions>
        <SubmitButton />
      </FormActions>
    </form>
  );
}
