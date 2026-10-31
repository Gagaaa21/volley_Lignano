import { RUN_MIN } from "@/lib/diretta/overlayEvents";
import { DEFAULT_OPPONENT_COLOR, HOME_TEAM_LABEL, teamColor } from "@/lib/liveScore";
import type {
  Match,
  PublicLineup,
  PublicLiveScore,
  PublicMatchInfo,
  PublicPlayer,
  PublicSetRecap,
  PublicSetRecapTeam,
  PublicSubstitution,
} from "@/lib/types";
import { setPointHolder, setsToWin } from "@/lib/volleyRules";
import { lineupWrittenThisSet } from "./court";
import { currentServer, deriveScout, setTarget, type ScoutCourt, type ScoutSet, type ScoutView } from "./derive";
import { estimateMinutes, setRecapCounts, type SetRecapCounts } from "./stats";
import type { MatchScout, ScoutPlayer, ScoutSettings } from "./types";

/** I cambi del set in corso che la risposta pubblica porta (gli ultimi): bastano per annunciare un cambio doppio o triplo. */
export const PUBLIC_SUBS_MAX = 6;

/** La partita come la legge il punteggio pubblico: squadra, categoria e avversaria; data e palazzetto, quando ci sono, per la presentazione. */
export type PublicMatch = Pick<Match, "team" | "category" | "opponent"> & Partial<Pick<Match, "isHome" | "location" | "matchDate" | "isFriendly">>;

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

/**
 * Una nostra giocatrice per la grafica della diretta video: il numero di maglia e, solo con `names`, il nome. Chi non è in rosa
 * (una posizione vuota, una giocatrice tolta dopo) è null.
 */
function publicPlayer(roster: ScoutPlayer[], id: string | null | undefined, names: boolean): PublicPlayer | null {
  if (!id) return null;
  const player = roster.find((p) => p.id === id);
  if (!player) return null;
  const name = player.name.trim();
  return names && name ? { number: player.number, name } : { number: player.number };
}

/** I nostri cambi del set in corso (gli ultimi PUBLIC_SUBS_MAX), con chi entra e chi esce. */
function publicSubs(set: ScoutSet, roster: ScoutPlayer[], names: boolean): PublicSubstitution[] {
  return set.subs
    .filter((sub) => sub.side === "us")
    .slice(-PUBLIC_SUBS_MAX)
    .map((sub) => ({
      id: sub.id,
      in: publicPlayer(roster, sub.in, names) ?? { number: null },
      out: publicPlayer(roster, sub.out, names) ?? { number: null },
      score: { home: sub.score.us, away: sub.score.opp },
    }));
}

function publicLineup(set: number, court: ScoutCourt, roster: ScoutPlayer[], names: boolean): PublicLineup {
  return {
    set,
    positions: court.positions.slice(0, 6).map((id) => publicPlayer(roster, id, names)),
    libero: publicPlayer(roster, court.libero, names),
  };
}

/**
 * La nostra formazione del set in corso: a set cominciato quella di partenza; a 0–0 quella scritta per questo set (al 1° set
 * quella della preparazione, dal 2° solo dopo che lo staff ha confermato con quale si ricomincia). Senza formazione, niente.
 */
function currentLineup(view: ScoutView, events: MatchScout["events"], roster: ScoutPlayer[], names: boolean): PublicLineup | null {
  const set = view.current;
  if (!set) return null;
  if (set.rallies.length > 0) return set.lineups.us ? publicLineup(set.n, set.lineups.us, roster, names) : null;
  if (!view.court.us || (set.n > 1 && !lineupWrittenThisSet(events))) return null;
  return publicLineup(set.n, view.court.us, roster, names);
}

const publicCounts = (counts: SetRecapCounts): PublicSetRecapTeam => ({ ...counts });

/** I numeri di tutta la partita: la somma dei set giocati, con la serie più lunga. */
function matchCounts(sets: ScoutSet[]): { home: PublicSetRecapTeam; away: PublicSetRecapTeam } | null {
  const played = sets.filter((set) => set.rallies.length > 0);
  if (played.length === 0) return null;
  const total = { us: { attack: 0, block: 0, ace: 0, gifts: 0, run: 0, timeouts: 0 }, opp: { attack: 0, block: 0, ace: 0, gifts: 0, run: 0, timeouts: 0 } };
  for (const set of played) {
    const counts = setRecapCounts(set);
    for (const side of ["us", "opp"] as const) {
      const into = total[side];
      const from = counts[side];
      into.attack += from.attack;
      into.block += from.block;
      into.ace += from.ace;
      into.gifts += from.gifts;
      into.timeouts += from.timeouts;
      into.run = Math.max(into.run, from.run);
    }
  }
  return { home: total.us, away: total.opp };
}

/** La serie di punti in corso nel set, se è lunga almeno RUN_MIN. */
function runInProgress(set: ScoutSet | null): PublicLiveScore["run"] | null {
  if (!set || set.rallies.length === 0) return null;
  const last = set.rallies[set.rallies.length - 1].winner;
  let points = 0;
  for (let i = set.rallies.length - 1; i >= 0 && set.rallies[i].winner === last; i--) points += 1;
  return points >= RUN_MIN ? { side: last === "us" ? "home" : "away", points } : null;
}

/** Data, palazzetto, casa o trasferta: quello che il calendario del sito già mostra a tutti. */
function matchInfo(match: PublicMatch): PublicMatchInfo | null {
  if (!match.matchDate) return null;
  return { date: match.matchDate, venue: match.location?.trim() || null, home: match.isHome ?? true, friendly: match.isFriendly ?? false };
}

/** Il resoconto di un set chiuso: totali di squadra (attacchi, muri, ace, errori dell'avversaria, serie, time-out) e durata. */
function publicSetRecap(set: ScoutSet): PublicSetRecap {
  const counts = setRecapCounts(set);
  return { n: set.n, minutes: estimateMinutes(set), home: counts.us, away: counts.opp };
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
 * batte) e, per la grafica della diretta video, i numeri di squadra, la serie
 * in corso, i nostri cambi e la nostra formazione con i numeri di maglia (i
 * nomi solo con `publicNames` acceso). Mai i dettagli degli scambi né chi ha
 * fatto punto. Esce solo se lo staff ha acceso «Punteggio live»; il resto
 * dello scout resta riservato. Finché non c'è un punto è la partita «non
 * iniziata» (0–0, `notStarted`): il sito pubblico non la mostra, la grafica
 * della diretta video sì, così la barra (e la presentazione) c'è appena si
 * accende il live.
 */
export function toPublicScoutScore(
  scout: Pick<MatchScout, "settings" | "events" | "finished" | "updatedAt"> & Partial<Pick<MatchScout, "roster">>,
  match: PublicMatch,
): PublicLiveScore | null {
  if (!scout.settings.publicLive) return null;
  const view = deriveScout(scout);
  const roster = scout.roster?.us ?? [];
  const names = scout.settings.publicNames === true;
  const info = matchInfo(match);
  const lineup = currentLineup(view, scout.events, roster, names);
  if (view.rallies.length === 0) {
    // Una partita chiusa a mano senza nemmeno un punto non ha niente da far vedere.
    if (scout.finished) return null;
    const subs = view.current ? publicSubs(view.current, roster, names) : [];
    return {
      team: match.team,
      category: match.category,
      ...publicTeams(match, { score: 0, sets: 0 }, { score: 0, sets: 0 }),
      serving: null,
      sets: [],
      timeouts: { home: 0, away: 0 },
      finished: false,
      ...(subs.length > 0 ? { subs } : {}),
      ...(lineup ? { lineup } : {}),
      ...(info ? { info } : {}),
      notStarted: true,
      ...(scout.settings.warmupAt ? { warmupAt: new Date(scout.settings.warmupAt).toISOString() } : {}),
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
  // L'ultimo set chiuso (a partita chiusa a mano, l'ultimo giocato) con i suoi numeri: la grafica di fine set lo usa quando se ne chiude uno.
  const lastDone = [...view.sets].reverse().find((set) => (finished ? set.rallies.length > 0 : set.closed));
  // Il set in corso (non a partita finita): i suoi numeri dal primo punto, la serie, i cambi.
  const live = finished ? null : view.current;
  const setCounts = live && live.rallies.length > 0 ? setRecapCounts(live) : null;
  const run = runInProgress(live);
  const subs = live ? publicSubs(live, roster, names) : [];
  const totals = matchCounts(view.sets);

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
    ...(lastDone ? { recap: publicSetRecap(lastDone) } : {}),
    ...(setCounts ? { setStats: { home: publicCounts(setCounts.us), away: publicCounts(setCounts.opp) } } : {}),
    ...(totals ? { matchStats: totals } : {}),
    ...(run ? { run } : {}),
    ...(subs.length > 0 ? { subs } : {}),
    ...(!finished && lineup ? { lineup } : {}),
    ...(info ? { info } : {}),
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
