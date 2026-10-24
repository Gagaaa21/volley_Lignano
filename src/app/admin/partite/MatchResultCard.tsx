"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Pencil, Save, Trophy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { FieldError, Input, Toggle } from "@/components/ui/Field";
import { TournamentGamesEditor, tournamentGamesToFormState, type TournamentGameFormState } from "@/components/admin/TournamentGamesEditor";
import { cn } from "@/lib/cn";
import type { Match } from "@/lib/types";
import { saveMatchResultAction, type MatchResultFormState } from "./actions";

const MAX_SETS = 5;
const initialState: MatchResultFormState = {};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} data-match-result-save>
      <Save className="h-4 w-4" />
      {pending ? "Salvataggio…" : "Salva risultato"}
    </Button>
  );
}

function hasResult(match: Match): boolean {
  if (match.isTournament) return match.tournamentGames?.some((game) => game.setScores.length > 0) ?? false;
  return match.resultSetsWon !== null && match.resultSetsLost !== null;
}

/** Il risultato già scritto, in grande: vinta o persa e i parziali (o, per un torneo, una riga per avversaria). */
function ResultSummary({ match }: { match: Match }) {
  if (match.isTournament) {
    return (
      <ul className="space-y-1.5" data-match-result-summary>
        {(match.tournamentGames ?? [])
          .filter((game) => game.setScores.length > 0)
          .map((game) => {
            const won = game.setScores.filter((set) => set.us > set.them).length;
            const lost = game.setScores.length - won;
            return (
              <li key={game.id} className="flex flex-wrap items-baseline gap-x-3 text-sm">
                <span className={cn("tabular font-display text-lg font-extrabold", won > lost ? "text-success" : "text-foreground/70")}>
                  {won}–{lost}
                </span>
                <span className="font-semibold text-foreground">{game.opponent}</span>
                <span className="tabular text-muted-foreground">{game.setScores.map((set) => `${set.us}-${set.them}`).join("  ")}</span>
              </li>
            );
          })}
      </ul>
    );
  }
  const won = (match.resultSetsWon ?? 0) > (match.resultSetsLost ?? 0);
  return (
    <div className="flex flex-wrap items-end gap-x-5 gap-y-1" data-match-result-summary>
      <span className={cn("display-wide tabular text-[2.25rem] leading-none", won ? "text-success" : "text-foreground/75")}>
        {match.resultSetsWon}–{match.resultSetsLost}
      </span>
      <span className={cn("pb-1 text-xs font-bold uppercase tracking-[0.08em]", won ? "text-success" : "text-destructive")}>{won ? "Vinta" : "Persa"}</span>
      {match.setScores && match.setScores.length > 0 && (
        <span className="tabular pb-1 text-sm text-muted-foreground">{match.setScores.map((set) => `${set.us}-${set.them}`).join("   ")}</span>
      )}
    </div>
  );
}

/**
 * Il riquadro «Risultato» della scheda partita, a partita giocata: il risultato in grande, oppure i campi per scriverlo
 * (parziali set per set, o una partita per avversaria nei tornei). Si salva da solo, senza aprire i dettagli della partita, e
 * avvisa chi segue il calendario con «Vinta 3-1» e i parziali.
 */
export function MatchResultCard({ match }: { match: Match }) {
  const [state, formAction] = useActionState(saveMatchResultAction, initialState);
  const saved = hasResult(match);
  const [editing, setEditing] = useState(!saved);
  const [games, setGames] = useState<TournamentGameFormState[]>(() => tournamentGamesToFormState(match.tournamentGames));
  // Dopo un salvataggio riuscito si torna al riepilogo; dopo un errore i campi restano aperti con quello che si era scritto.
  const [handled, setHandled] = useState<MatchResultFormState>(initialState);
  if (state !== handled) {
    setHandled(state);
    if (state.message && !state.error) setEditing(false);
  }
  const values = state.error ? state.values : undefined;
  const open = editing || !saved;

  return (
    <Card className="mb-6" data-match-result={saved ? "saved" : "missing"}>
      <CardBody className="pt-5 sm:pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="icon-chip h-10 w-10">
              <Trophy className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-base font-bold text-foreground">Risultato</p>
              <p className="text-sm text-muted-foreground">
                {saved ? "Quello che vedono genitori e atlete nel calendario." : "Scrivilo a partita giocata: si vede subito nel calendario."}
              </p>
            </div>
          </div>
          {saved && !open && (
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)} data-match-result-edit>
              <Pencil className="h-4 w-4" />
              Correggi
            </Button>
          )}
        </div>

        {saved && !open && (
          <div className="mt-4">
            <ResultSummary match={match} />
            {state.message && <p className="mt-2 text-sm font-semibold text-success">{state.message}</p>}
          </div>
        )}

        {open && (
          <form action={formAction} className="mt-4 space-y-4" noValidate>
            <input type="hidden" name="id" value={match.id} />
            {match.isTournament ? (
              <TournamentGamesEditor
                games={games}
                onChange={setGames}
                hiddenFieldName="tournamentGames"
                title="Risultati del torneo"
                hint="Una riga per avversaria affrontata. Lascia in bianco i set non giocati, o l'intera partita se non conosci ancora il risultato."
              />
            ) : (
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
                      defaultValue={values?.setUs[i] ?? match.setScores?.[i]?.us ?? ""}
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
                      defaultValue={values?.setThem[i] ?? match.setScores?.[i]?.them ?? ""}
                      className="tabular px-1 text-center"
                      aria-label={`Punti avversario, set ${i + 1}`}
                    />
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">I set non giocati restano vuoti: vinti e persi si contano da soli.</p>
              </div>
            )}
            <Toggle name="notify" label="Avvisa chi segue il calendario" description="Con il risultato e i parziali." defaultChecked />
            {state.error && <FieldError>{state.error}</FieldError>}
            <div className="flex flex-wrap items-center gap-2">
              <SaveButton />
              {saved && (
                <Button type="button" variant="quiet" onClick={() => setEditing(false)}>
                  Annulla
                </Button>
              )}
            </div>
          </form>
        )}
      </CardBody>
    </Card>
  );
}
