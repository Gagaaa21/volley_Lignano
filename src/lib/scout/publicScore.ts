import { DEFAULT_OPPONENT_COLOR, HOME_TEAM_LABEL, teamColor } from "@/lib/liveScore";
import type { Match, PublicLiveScore } from "@/lib/types";
import { currentServer, deriveScout } from "./derive";
import type { MatchScout } from "./types";

/**
 * Il punteggio live pubblico ricavato dallo scout: lo stesso riquadro che il
 * sito mostra per il Live score (squadre, punteggio del set, set vinti, chi
 * batte), mai nomi delle giocatrici, numeri di maglia o dettagli degli
 * scambi. Esce solo se lo staff ha acceso «Punteggio live» e ha segnato almeno
 * un punto; il resto dello scout resta riservato.
 */
export function toPublicScoutScore(
  scout: Pick<MatchScout, "settings" | "events" | "finished" | "updatedAt">,
  match: Pick<Match, "team" | "category" | "opponent">,
): PublicLiveScore | null {
  if (!scout.settings.publicLive) return null;
  const view = deriveScout(scout);
  if (view.rallies.length === 0) return null;

  const finished = view.decided || scout.finished;
  // Chiusa la partita il punteggio del set è già «azzerato» (come nel Live score): contano i set vinti.
  const points = finished || !view.current ? { us: 0, opp: 0 } : view.current.score;
  const server = finished ? null : currentServer(view);
  // A partita chiusa a mano l'ultimo set, anche se non chiuso, entra nel riepilogo dei set.
  const playedSets = (finished ? view.sets.filter((set) => set.rallies.length > 0) : view.sets.filter((set) => set.closed)).map(
    (set) => ({ home: set.score.us, away: set.score.opp }),
  );

  return {
    team: match.team,
    category: match.category,
    home: { name: HOME_TEAM_LABEL, color: teamColor("A", "match", DEFAULT_OPPONENT_COLOR), score: points.us, sets: view.setsWon.us },
    away: {
      name: match.opponent.trim() || "Avversaria",
      color: teamColor("B", "match", DEFAULT_OPPONENT_COLOR),
      score: points.opp,
      sets: view.setsWon.opp,
    },
    serving: server === "us" ? "home" : server === "opp" ? "away" : null,
    sets: playedSets,
    finished,
    updatedAt: scout.updatedAt,
  };
}

/**
 * Il Live score e lo Scout possono avere il punteggio pubblico acceso in
 * contemporanea (di solito se ci si è dimenticati di spegnere uno dei due):
 * il sito ne mostra uno solo, quello aggiornato per ultimo.
 */
export function latestPublicLive(a: PublicLiveScore | null, b: PublicLiveScore | null): PublicLiveScore | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(b.updatedAt) > Date.parse(a.updatedAt) ? b : a;
}
