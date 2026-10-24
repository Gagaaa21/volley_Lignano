import { deriveScout, type ScoutScore } from "./derive";
import { effectiveLevel } from "./levels";
import type { ScoutData, ScoutLevel } from "./types";
import type { Match } from "@/lib/types";

/** Lo scout vale per le partite di campionato e le amichevoli di U14/U15, non per i tornei né per il Minivolley. */
export function isScoutable(match: Pick<Match, "team" | "isTournament">): boolean {
  return match.team === "u14u15" && !match.isTournament;
}

/** A che punto è lo scout di una partita, per l'elenco. */
export interface ScoutSummary {
  /** none = nessun punto segnato; live = in corso o interrotto; done = partita decisa o chiusa. */
  state: "none" | "live" | "done";
  setsWon: ScoutScore;
  /** Il set in corso (o l'ultimo se la partita è chiusa): numero e punteggio. */
  lastSet: { n: number; score: ScoutScore } | null;
  /** Punteggio finale di ogni set giocato. */
  sets: ScoutScore[];
  rallies: number;
  /** Il livello con cui è stata segnata (Base o Con ricezioni). */
  level: ScoutLevel;
}

export function summarizeScout(data: Pick<ScoutData, "settings" | "events" | "finished"> | null): ScoutSummary {
  if (!data) return { state: "none", setsWon: { us: 0, opp: 0 }, lastSet: null, sets: [], rallies: 0, level: "base" };
  const view = deriveScout(data);
  const level = effectiveLevel(data);
  if (view.rallies.length === 0) return { state: "none", setsWon: { us: 0, opp: 0 }, lastSet: null, sets: [], rallies: 0, level };
  const played = view.sets.filter((set) => set.rallies.length > 0);
  const last = played[played.length - 1];
  return {
    state: view.decided || data.finished ? "done" : "live",
    setsWon: view.setsWon,
    lastSet: last ? { n: last.n, score: last.score } : null,
    sets: played.map((set) => set.score),
    rallies: view.rallies.length,
    level,
  };
}
