import { rallyWinner } from "./rules";
import { touchOutcome } from "./touches";
import {
  otherSide,
  type ScoutData,
  type ScoutEvent,
  type ScoutFormat,
  type ScoutHow,
  type ScoutSettings,
  type ScoutSide,
  type ScoutTouch,
} from "./types";

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
  /** Di uno scambio chiuso da un tocco è l'id di quel tocco; altrimenti quello dell'esito segnato. */
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
  /** I tocchi segnati in questo scambio, in ordine (vuoto nel livello Base). Se lo ha chiuso un tocco, è l'ultimo. */
  touches: ScoutTouch[];
  /** Come si è chiuso: dal voto di un tocco («touch») o con l'esito scelto a mano («outcome»). */
  closedBy: "touch" | "outcome";
  /** Gli eventi da cui è fatto (i tocchi, più l'esito se segnato a mano): servono a toglierlo o correggerlo per intero. */
  eventIds: string[];
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
  /** I tocchi dello scambio in corso, segnati ma non ancora chiusi da un punto. */
  pending: ScoutTouch[];
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

/** Chi era a muro nell'esito scelto a mano non dice chi attaccava: se l'ultimo tocco segnato è un attacco avversario, è lui. */
function inferredVictim(actor: ScoutSide, how: ScoutHow, victim: string | null, pending: readonly ScoutTouch[]): string | null {
  if (how !== "block") return null;
  if (victim) return victim;
  for (let i = pending.length - 1; i >= 0; i--) {
    if (pending[i].skill === "attack" && pending[i].side !== actor) return pending[i].player;
  }
  return null;
}

export function deriveScout(data: Pick<ScoutData, "settings" | "events">): ScoutView {
  const { settings, events } = data;
  const sets: ScoutSet[] = [newSet(1, settings.firstServer)];
  const rallies: ScoutRally[] = [];
  const setsWon: ScoutScore = { us: 0, opp: 0 };
  let cur: ScoutSet | null = sets[0];
  let decided = false;
  let pending: ScoutTouch[] = [];

  /** Chiude lo scambio in corso con questo esito: i tocchi in sospeso passano allo scambio. */
  function closeRally(
    set: ScoutSet,
    id: string,
    at: number,
    outcome: { actor: ScoutSide; how: ScoutHow; player: string | null; victim: string | null },
    closedBy: ScoutRally["closedBy"],
  ) {
    const winner = rallyWinner(outcome.how, outcome.actor);
    const last: ScoutRally | undefined = set.rallies[set.rallies.length - 1];
    const score: ScoutScore = { ...set.score, [winner]: set.score[winner] + 1 };
    const touches = pending;
    pending = [];
    const rally: ScoutRally = {
      id,
      set: set.n,
      n: set.rallies.length + 1,
      at,
      actor: outcome.actor,
      winner,
      how: outcome.how,
      player: outcome.player,
      victim: outcome.how === "block" ? outcome.victim : null,
      server: last ? last.winner : set.firstServer,
      score,
      touches,
      closedBy,
      eventIds: closedBy === "outcome" ? [...touches.map((t) => t.id), id] : touches.map((t) => t.id),
    };
    set.rallies.push(rally);
    rallies.push(rally);
    set.score = score;
    // L'inizio del set è il primo tocco segnato, se ce ne sono: la durata stimata è meno per difetto.
    set.startedAt ??= touches.length > 0 ? touches[0].at : at;
    set.endedAt = at;
  }

  for (const event of events) {
    // A partita decisa non si aggiunge altro: eventuali eventi in coda (dati vecchi o a mano) si ignorano.
    if (decided || !cur) break;
    if (event.type === "touch") {
      const touch: ScoutTouch = {
        id: event.id,
        at: event.at,
        side: event.side,
        skill: event.skill,
        player: event.player,
        grade: event.grade,
        zone: event.zone,
      };
      const outcome = touchOutcome(touch, pending);
      pending.push(touch);
      if (outcome) closeRally(cur, event.id, event.at, outcome, "touch");
    } else if (event.type === "rally") {
      const outcome = {
        actor: event.actor,
        how: event.how,
        player: event.player,
        victim: inferredVictim(event.actor, event.how, event.victim, pending),
      };
      closeRally(cur, event.id, event.at, outcome, "outcome");
    } else {
      // Fine set: i tocchi di uno scambio rimasto a metà non contano.
      pending = [];
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

  return { sets, rallies, setsWon, current: cur, decided, pending: cur ? pending : [] };
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
