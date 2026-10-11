import { rallyWinner } from "./rules";
import { otherSide, type ScoutData, type ScoutEvent, type ScoutFormat, type ScoutHow, type ScoutSettings, type ScoutSide } from "./types";

/**
 * Dalla sequenza di eventi (scambi e fine set) si ricava tutto il resto:
 * punteggio di ogni set, set vinti, chi batteva in ogni scambio. Niente si
 * salva due volte, quindi correggere o annullare un punto non può lasciare
 * punteggi o battute fuori sincrono.
 */

export interface ScoutScore {
  us: number;
  opp: number;
}

export interface ScoutRally {
  id: string;
  /** 1 = primo set. */
  set: number;
  /** Numero dello scambio nel set (1 = primo). */
  n: number;
  at: number;
  actor: ScoutSide;
  winner: ScoutSide;
  how: ScoutHow;
  player: string | null;
  victim: string | null;
  /** Chi batteva all'inizio dello scambio (cambio palla se perde, break point se vince). */
  server: ScoutSide;
  /** Punteggio del set dopo questo punto. */
  score: ScoutScore;
}

export interface ScoutSet {
  n: number;
  firstServer: ScoutSide;
  rallies: ScoutRally[];
  score: ScoutScore;
  closed: boolean;
  /** Chi ha vinto il set, solo a set chiuso e non in parità. */
  winner: ScoutSide | null;
  /** Orario del primo e dell'ultimo punto (ms), null se il set è vuoto. */
  startedAt: number | null;
  endedAt: number | null;
}

export interface ScoutView {
  sets: ScoutSet[];
  rallies: ScoutRally[];
  /** Set vinti da ciascuna squadra (solo set chiusi). */
  setsWon: ScoutScore;
  /** Il set in corso, null a partita decisa. */
  current: ScoutSet | null;
  decided: boolean;
}

/** Quanti set al massimo prevede la formula (il decisivo è l'ultimo). */
export function maxSets(format: ScoutFormat): number {
  return format === "bo5" ? 5 : 3;
}

/** A quanti punti finisce il set `setNumber`: il decisivo ha il suo limite (15). */
export function setTarget(settings: ScoutSettings, setNumber: number): number {
  return setNumber >= maxSets(settings.format) ? settings.lastSetPoints : settings.setPoints;
}

/** Set vinto: si arriva al limite con almeno due punti di scarto (si prosegue ai vantaggi). */
export function isSetOver(score: ScoutScore, target: number): boolean {
  return Math.max(score.us, score.opp) >= target && Math.abs(score.us - score.opp) >= 2;
}

export function isMatchDecided(format: ScoutFormat, setsWon: ScoutScore, closedSets: number): boolean {
  if (format === "fixed3") return closedSets >= 3;
  const needed = format === "bo5" ? 3 : 2;
  return setsWon.us >= needed || setsWon.opp >= needed;
}

function newSet(n: number, firstServer: ScoutSide): ScoutSet {
  return {
    n,
    firstServer,
    rallies: [],
    score: { us: 0, opp: 0 },
    closed: false,
    winner: null,
    startedAt: null,
    endedAt: null,
  };
}

export function deriveScout(data: Pick<ScoutData, "settings" | "events">): ScoutView {
  const { settings, events } = data;
  const sets: ScoutSet[] = [newSet(1, settings.firstServer)];
  const rallies: ScoutRally[] = [];
  const setsWon: ScoutScore = { us: 0, opp: 0 };
  let cur: ScoutSet | null = sets[0];
  let decided = false;

  for (const event of events) {
    // A partita decisa non si aggiunge altro: eventuali eventi in coda (dati vecchi o a mano) si ignorano.
    if (decided || !cur) break;
    if (event.type === "rally") {
      const winner = rallyWinner(event.how, event.actor);
      const last: ScoutRally | undefined = cur.rallies[cur.rallies.length - 1];
      const score: ScoutScore = { ...cur.score, [winner]: cur.score[winner] + 1 };
      const rally: ScoutRally = {
        id: event.id,
        set: cur.n,
        n: cur.rallies.length + 1,
        at: event.at,
        actor: event.actor,
        winner,
        how: event.how,
        player: event.player,
        victim: event.how === "block" ? event.victim : null,
        server: last ? last.winner : cur.firstServer,
        score,
      };
      cur.rallies.push(rally);
      rallies.push(rally);
      cur.score = score;
      cur.startedAt ??= event.at;
      cur.endedAt = event.at;
    } else {
      cur.closed = true;
      cur.winner = cur.score.us === cur.score.opp ? null : cur.score.us > cur.score.opp ? "us" : "opp";
      if (cur.winner) setsWon[cur.winner] += 1;
      if (isMatchDecided(settings.format, setsWon, sets.length)) {
        decided = true;
        cur = null;
      } else {
        cur = newSet(sets.length + 1, event.nextServer);
        sets.push(cur);
      }
    }
  }

  return { sets, rallies, setsWon, current: cur, decided };
}

/** Il set in corso ha raggiunto il limite con due punti di scarto: si può chiuderlo. */
export function suggestedSetEnd(view: ScoutView, settings: ScoutSettings): { winner: ScoutSide; score: ScoutScore } | null {
  const cur = view.current;
  if (!cur) return null;
  if (!isSetOver(cur.score, setTarget(settings, cur.n))) return null;
  return { winner: cur.score.us > cur.score.opp ? "us" : "opp", score: cur.score };
}

/** Di norma i set si alternano: chi ha battato per primo nel set appena chiuso batte per secondo nel successivo. */
export function defaultNextServer(set: Pick<ScoutSet, "firstServer">): ScoutSide {
  return otherSide(set.firstServer);
}

/** Chi batte nello scambio che sta per essere giocato nel set in corso. */
export function currentServer(view: ScoutView): ScoutSide | null {
  const cur = view.current;
  if (!cur) return null;
  const last = cur.rallies[cur.rallies.length - 1];
  return last ? last.winner : cur.firstServer;
}

export function lastEvent(events: ScoutEvent[]): ScoutEvent | null {
  return events[events.length - 1] ?? null;
}
