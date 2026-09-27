"use client";

import { Plus, Trash2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import type { TournamentGame } from "@/lib/types";

export const TOURNAMENT_GAME_MAX_SETS = 5;

export interface TournamentGameFormState {
  key: string;
  opponent: string;
  setUs: string[];
  setThem: string[];
}

export function emptyTournamentGame(): TournamentGameFormState {
  return {
    key: crypto.randomUUID(),
    opponent: "",
    setUs: Array(TOURNAMENT_GAME_MAX_SETS).fill(""),
    setThem: Array(TOURNAMENT_GAME_MAX_SETS).fill(""),
  };
}

export function tournamentGamesToFormState(games: TournamentGame[] | null | undefined): TournamentGameFormState[] {
  if (!games || games.length === 0) return [];
  return games.map((g) => ({
    key: g.id,
    opponent: g.opponent,
    setUs: Array.from({ length: TOURNAMENT_GAME_MAX_SETS }, (_, i) => (g.setScores[i] ? String(g.setScores[i].us) : "")),
    setThem: Array.from({ length: TOURNAMENT_GAME_MAX_SETS }, (_, i) => (g.setScores[i] ? String(g.setScores[i].them) : "")),
  }));
}

/** Blocco ripetibile "partita del torneo" (avversaria + griglia a 5 set),
 * condiviso — a meno del testo — tra il risultato reale (MatchForm) e il
 * pronostico (PredictionForm). Stato controllato React (lista di lunghezza
 * variabile) serializzato in un input hidden JSON al submit, letto e
 * validato lato server da parseTournamentGamesJson. */
export function TournamentGamesEditor({
  games,
  onChange,
  title,
  hint,
  hiddenFieldName,
}: {
  games: TournamentGameFormState[];
  onChange: (games: TournamentGameFormState[]) => void;
  title: string;
  hint: string;
  hiddenFieldName: string;
}) {
  function updateGame(index: number, patch: Partial<TournamentGameFormState>) {
    onChange(games.map((g, i) => (i === index ? { ...g, ...patch } : g)));
  }

  function updateSet(index: number, setIndex: number, side: "setUs" | "setThem", value: string) {
    const game = games[index];
    const next = [...game[side]];
    next[setIndex] = value;
    updateGame(index, { [side]: next });
  }

  function addGame() {
    onChange([...games, emptyTournamentGame()]);
  }

  function removeGame(index: number) {
    onChange(games.filter((_, i) => i !== index));
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-muted/60 px-3.5 py-3.5">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground/85">
        <Trophy className="h-4 w-4 text-sand-600" />
        {title}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>

      <div className="mt-3 space-y-3">
        {games.map((game, gi) => (
          <div key={game.key} className="rounded-lg border border-border-subtle bg-surface p-3">
            <div className="flex items-center gap-2">
              <Input
                value={game.opponent}
                onChange={(e) => updateGame(gi, { opponent: e.target.value })}
                placeholder="Nome avversaria"
                aria-label={`Avversaria, partita ${gi + 1}`}
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => removeGame(gi)}
                aria-label={`Rimuovi partita ${gi + 1}`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-foreground/40 transition-colors hover:bg-destructive/8 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex items-center gap-3 pl-14 text-[11px] font-semibold uppercase tracking-wide text-foreground/40">
              <span className="w-14 text-center">Lignano</span>
              <span className="w-3" />
              <span className="w-14 text-center">Avv.</span>
            </div>
            <div className="mt-1.5 space-y-2">
              {Array.from({ length: TOURNAMENT_GAME_MAX_SETS }, (_, si) => (
                <div key={si} className="flex items-center gap-3">
                  <span className="w-14 shrink-0 text-sm font-medium text-foreground/60">Set {si + 1}</span>
                  <Input
                    type="number"
                    min={0}
                    max={99}
                    value={game.setUs[si]}
                    onChange={(e) => updateSet(gi, si, "setUs", e.target.value)}
                    className="w-14 px-2 text-center"
                    aria-label={`Punti Lignano, partita ${gi + 1}, set ${si + 1}`}
                  />
                  <span className="text-foreground/40">–</span>
                  <Input
                    type="number"
                    min={0}
                    max={99}
                    value={game.setThem[si]}
                    onChange={(e) => updateSet(gi, si, "setThem", e.target.value)}
                    className="w-14 px-2 text-center"
                    aria-label={`Punti avversario, partita ${gi + 1}, set ${si + 1}`}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        <Button type="button" variant="outline" size="sm" onClick={addGame}>
          <Plus className="h-4 w-4" />
          Aggiungi partita
        </Button>
      </div>

      <input
        type="hidden"
        name={hiddenFieldName}
        value={JSON.stringify(games.map((g) => ({ opponent: g.opponent, setUs: g.setUs, setThem: g.setThem })))}
      />
    </div>
  );
}
