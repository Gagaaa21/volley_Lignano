import { DEFAULT_OPPONENT_COLOR, HOME_TEAM_LABEL, teamColor } from "@/lib/liveScore";
import type { Match, PublicLiveScore } from "@/lib/types";
import { setPointHolder, setsToWin } from "@/lib/volleyRules";
import { currentServer, deriveScout, setTarget, type ScoutView } from "./derive";
import type { MatchScout, ScoutSettings } from "./types";

/**
 * Il punto che chiude il set o la partita: chi ce l'ha in mano adesso. Nessuno a partita finita, a set già vinto (in attesa
 * che lo si chiuda) o con 3 set obbligatori, dove la partita non finisce prima del 3° set e non c'è un «match point».
 */
function pointInHand(view: ScoutView, settings: ScoutSettings, finished: boolean): PublicLiveScore["point"] {
  if (finished || !view.current) return null;
  const { us, opp } = view.current.score;
  const holder = setPointHolder(us, opp, setTarget(settings, view.current.n));
  if (!holder) return null;
  const needed = setsToWin(settings.format);
  const sets = holder === "a" ? view.setsWon.us : view.setsWon.opp;
  return { side: holder === "a" ? "home" : "away", kind: needed !== null && sets + 1 >= needed ? "match" : "set" };
}

/** Le due squadre del punteggio pubblico: Lignano è sempre «home»; senza nome dell'avversaria si scrive «Avversaria». */
function publicTeams(match: Pick<Match, "opponent">, home: { score: number; sets: number }, away: { score: number; sets: number }) {
  return {
    home: { name: HOME_TEAM_LABEL, color: teamColor("A", "match", DEFAULT_OPPONENT_COLOR), ...home },
    away: { name: match.opponent.trim() || "Avversaria", color: teamColor("B", "match", DEFAULT_OPPONENT_COLOR), ...away },
  };
}

/**
 * Il punteggio live pubblico ricavato dallo scout: lo stesso riquadro che il
 * sito mostra per il Live score (squadre, punteggio del set, set vinti, chi
 * batte), mai nomi delle giocatrici, numeri di maglia o dettagli degli
 * scambi. Esce solo se lo staff ha acceso «Punteggio live»; il resto dello
 * scout resta riservato. Finché non c'è un punto è la partita «non iniziata»
 * (0–0, `notStarted`): il sito pubblico non la mostra, la grafica della diretta
 * video sì, così la barra c'è appena si accende il live.
 */
export function toPublicScoutScore(
  scout: Pick<MatchScout, "settings" | "events" | "finished" | "updatedAt">,
  match: Pick<Match, "team" | "category" | "opponent">,
): PublicLiveScore | null {
  if (!scout.settings.publicLive) return null;
  const view = deriveScout(scout);
  if (view.rallies.length === 0) {
    // Una partita chiusa a mano senza nemmeno un punto non ha niente da far vedere.
    if (scout.finished) return null;
    return {
      team: match.team,
      category: match.category,
      ...publicTeams(match, { score: 0, sets: 0 }, { score: 0, sets: 0 }),
      serving: null,
      sets: [],
      timeouts: { home: 0, away: 0 },
      finished: false,
      notStarted: true,
      updatedAt: scout.updatedAt,
    };
  }

  const finished = view.decided || scout.finished;
  // Chiusa la partita il punteggio del set è già «azzerato» (come nel Live score): contano i set vinti.
  const points = finished || !view.current ? { us: 0, opp: 0 } : view.current.score;
  const server = finished ? null : currentServer(view);
  // A partita chiusa a mano l'ultimo set, anche se non chiuso, entra nel riepilogo dei set.
  const playedSets = (finished ? view.sets.filter((set) => set.rallies.length > 0) : view.sets.filter((set) => set.closed)).map(
    (set) => ({ home: set.score.us, away: set.score.opp }),
  );
  const point = pointInHand(view, scout.settings, finished);

  return {
    team: match.team,
    category: match.category,
    ...publicTeams(match, { score: points.us, sets: view.setsWon.us }, { score: points.opp, sets: view.setsWon.opp }),
    serving: server === "us" ? "home" : server === "opp" ? "away" : null,
    sets: playedSets,
    // I time-out del set in corso (due per squadra, vedi addTimeout); a partita finita non si mostrano.
    timeouts: {
      home: finished ? 0 : (view.current?.timeouts.filter((t) => t.side === "us").length ?? 0),
      away: finished ? 0 : (view.current?.timeouts.filter((t) => t.side === "opp").length ?? 0),
    },
    finished,
    // Solo quando c'è: negli altri momenti la risposta resta quella di sempre.
    ...(point ? { point } : {}),
    updatedAt: scout.updatedAt,
  };
}

/**
 * Il Live score e lo Scout possono avere il punteggio pubblico acceso in
 * contemporanea (di solito se ci si è dimenticati di spegnere uno dei due):
 * il sito ne mostra uno solo, quello aggiornato per ultimo. Una partita non
 * ancora iniziata (0–0) non ne copre mai una già in corso.
 */
export function latestPublicLive(a: PublicLiveScore | null, b: PublicLiveScore | null): PublicLiveScore | null {
  if (!a) return b;
  if (!b) return a;
  if (Boolean(a.notStarted) !== Boolean(b.notStarted)) return a.notStarted ? b : a;
  return Date.parse(b.updatedAt) > Date.parse(a.updatedAt) ? b : a;
}
