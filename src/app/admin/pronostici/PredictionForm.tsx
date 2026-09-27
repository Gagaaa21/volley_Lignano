"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Save, Target } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, FieldError, FieldHint } from "@/components/ui/Field";
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
    <Button type="submit" disabled={pending}>
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
    <form action={formAction} className="space-y-3.5" noValidate>
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

          <div className="flex items-center gap-3 pl-14 text-[11px] font-semibold uppercase tracking-wide text-foreground/40">
            <span className="w-14 text-center">Lignano</span>
            <span className="w-3" />
            <span className="w-14 text-center">Avv.</span>
          </div>
          <div className="space-y-2">
            {Array.from({ length: MAX_SETS }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-14 shrink-0 text-sm font-medium text-foreground/60">Set {i + 1}</span>
                <Input
                  type="number"
                  name="setUs"
                  min={0}
                  max={99}
                  defaultValue={existingSetScores?.[i]?.us ?? ""}
                  className="w-14 px-2 text-center"
                  aria-label={`Punti Lignano, set ${i + 1}`}
                />
                <span className="text-foreground/40">–</span>
                <Input
                  type="number"
                  name="setThem"
                  min={0}
                  max={99}
                  defaultValue={existingSetScores?.[i]?.them ?? ""}
                  className="w-14 px-2 text-center"
                  aria-label={`Punti avversario, set ${i + 1}`}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {state.error && (
        <div className="rounded-xl bg-destructive/8 px-3.5 py-2.5">
          <FieldError>{state.error}</FieldError>
        </div>
      )}

      <SubmitButton />
    </form>
  );
}
