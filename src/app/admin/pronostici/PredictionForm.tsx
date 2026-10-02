"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Save, Target } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, FieldError, FieldHint, FormActions } from "@/components/ui/Field";
import {
  TournamentGamesEditor,
  tournamentGamesToFormState,
  type TournamentGameFormState,
} from "@/components/admin/TournamentGamesEditor";
import { savePredictionAction, type PredictionFormState } from "./actions";
import type { SetScore, TournamentGame } from "@/lib/types";

const initialState: PredictionFormState = {};
const MAX_SETS = 5;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      <Save className="h-4 w-4" />
      {pending ? "Salvataggio…" : "Salva pronostico"}
    </Button>
  );
}

export function PredictionForm({
  matchId,
  isTournament,
  existingSetScores,
  existingTournamentGames,
}: {
  matchId: string;
  isTournament: boolean;
  existingSetScores: SetScore[] | null;
  existingTournamentGames: TournamentGame[] | null;
}) {
  const [state, formAction] = useActionState(savePredictionAction, initialState);
  const [tournamentGames, setTournamentGames] = useState<TournamentGameFormState[]>(() =>
    tournamentGamesToFormState(existingTournamentGames),
  );

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="matchId" value={matchId} />

      {isTournament ? (
        <TournamentGamesEditor
          games={tournamentGames}
          onChange={setTournamentGames}
          hiddenFieldName="tournamentGames"
          title="Il tuo pronostico"
          hint="Aggiungi una partita per ogni avversaria che pensi affronteremo, con il punteggio che prevedi. Una partita senza almeno un set valido non viene salvata."
        />
      ) : (
        <>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground/85">
            <Target className="h-4 w-4 text-sand-600" />
            Il tuo pronostico
          </p>
          <FieldHint>
            Inserisci i punti che prevedi per ogni set. Lascia in bianco i set che prevedi non si giochino: una
            squadra deve arrivare a 3 set vinti.
          </FieldHint>

          <div className="overflow-x-auto rounded-2xl border border-border bg-surface-muted p-3 sm:p-4">
            <div className="grid min-w-[19rem] grid-cols-[5.5rem_repeat(5,minmax(0,1fr))] items-center gap-1.5">
              <span />
              {Array.from({ length: MAX_SETS }, (_, i) => (
                <span key={i} className="text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Set {i + 1}
                </span>
              ))}
              <span className="text-sm font-semibold text-foreground">Lignano</span>
              {Array.from({ length: MAX_SETS }, (_, i) => (
                <Input
                  key={`us-${i}`}
                  type="number"
                  name="setUs"
                  min={0}
                  max={99}
                  inputMode="numeric"
                  defaultValue={existingSetScores?.[i]?.us ?? ""}
                  className="tabular px-1 text-center font-semibold"
                  aria-label={`Punti Lignano, set ${i + 1}`}
                />
              ))}
              <span className="text-sm font-semibold text-muted-foreground">Avversaria</span>
              {Array.from({ length: MAX_SETS }, (_, i) => (
                <Input
                  key={`them-${i}`}
                  type="number"
                  name="setThem"
                  min={0}
                  max={99}
                  inputMode="numeric"
                  defaultValue={existingSetScores?.[i]?.them ?? ""}
                  className="tabular px-1 text-center"
                  aria-label={`Punti avversario, set ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {state.error && (
        <div className="rounded-xl bg-destructive/8 px-3.5 py-2.5">
          <FieldError>{state.error}</FieldError>
        </div>
      )}

      <FormActions>
        <SubmitButton />
      </FormActions>
    </form>
  );
}
