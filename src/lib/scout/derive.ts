import { lineupAfterRally, refreshLibero, substituteLineup, substitutionProblemFor, type CourtLineup } from "@/lib/lineup";
import { isDecidingSet, isMatchDecided as isMatchDecidedBy, isSetWon, maxSets as maxSetsOf, targetForSet } from "@/lib/volleyRules";
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

/**
 * Chi sta in campo per una squadra, ricavato dalle formazioni e dai cambi
 * segnati (vedi ScoutLineupEvent): si ruota quando la squadra conquista la
 * battuta, e la libero entra e esce da sola, come nel Live score (lineup.ts).
 */
export interface ScoutCourt {
  /** Chi sta in ogni posizione 1…6 ("" = nessuna): la libero non c'è, qui compare chi sostituisce. */
  positions: string[];
  /** Chi gioca davvero in ogni posizione: come `positions`, con la libero al posto di chi sostituisce. */
  onCourt: string[];
  libero: string | null;
  /** Chi la libero sta sostituendo adesso, null se non è in campo. */
  liberoFor: string | null;
  hosts: [string, string];
  /** Rotazione nel set: 1 = quella di partenza, 2 dopo una rotazione, e così via fino alla 6. */
  rotation: number;
}

export type ScoutCourts = Record<ScoutSide, ScoutCourt | null>;

/** Un cambio fatto in un set. */
export interface ScoutSubstitution {
  id: string;
  at: number;
  side: ScoutSide;
  position: 1 | 2 | 3 | 4 | 5 | 6;
  out: string;
  in: string;
  /** Punteggio del set al momento del cambio. */
  score: ScoutScore;
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
  /** Chi era in campo all'inizio dello scambio (null per la squadra di cui non si segna la formazione). */
  court: ScoutCourts;
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
  /** La formazione con cui il set è cominciato (al primo scambio), per ogni squadra di cui è nota. */
  lineups: ScoutCourts;
  /** I cambi fatti nel set, in ordine. */
  subs: ScoutSubstitution[];
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
  /** Chi è in campo adesso, per ogni squadra di cui si segna la formazione. */
  court: ScoutCourts;
}

/** Quanti set al massimo prevede la formula (il decisivo è l'ultimo). */
export function maxSets(format: ScoutFormat): number {
  return maxSetsOf(format);
}

/** A quanti punti finisce il set `setNumber`: il decisivo ha il suo limite (15). */
export function setTarget(settings: ScoutSettings, setNumber: number): number {
  return targetForSet(settings, setNumber);
}

/** Set vinto: si arriva al limite con almeno due punti di scarto (si prosegue ai vantaggi). */
export function isSetOver(score: ScoutScore, target: number): boolean {
  return isSetWon(score.us, score.opp, target);
}

export function isMatchDecided(format: ScoutFormat, setsWon: ScoutScore, closedSets: number): boolean {
  return isMatchDecidedBy(format, setsWon.us, setsWon.opp, closedSets);
}

/** Il set è quello decisivo (l'ultimo possibile della formula). */
export function isDecisive(format: ScoutFormat, setNumber: number): boolean {
  return isDecidingSet(format, setNumber);
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
    lineups: { us: null, opp: null },
    subs: [],
  };
}

const SIDES: ScoutSide[] = ["us", "opp"];

/** La formazione di una squadra come la leggono le schermate. */
function snapshotOf(lineup: CourtLineup, rotations: number): ScoutCourt {
  const positions = lineup.positions.map((id) => id.trim());
  const libero = lineup.liberoName.trim() || null;
  return {
    positions,
    onCourt: positions.map((id) => (libero && id !== "" && lineup.liberoActiveFor === id ? libero : id)),
    libero,
    liberoFor: lineup.liberoActiveFor,
    hosts: [lineup.hostNames[0].trim(), lineup.hostNames[1].trim()],
    rotation: (rotations % 6) + 1,
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
  // Chi è in campo (solo per le squadre di cui si segna la formazione), con la formazione con cui è cominciato il set e le rotazioni fatte.
  const courts: Record<ScoutSide, CourtLineup | null> = { us: null, opp: null };
  const starts: Record<ScoutSide, CourtLineup | null> = { us: null, opp: null };
  const rotations: Record<ScoutSide, number> = { us: 0, opp: 0 };

  const snapshots = (): ScoutCourts => ({
    us: courts.us ? snapshotOf(courts.us, rotations.us) : null,
    opp: courts.opp ? snapshotOf(courts.opp, rotations.opp) : null,
  });

  /** Chi batte nello scambio che sta per essere giocato nel set `set`. */
  const serverOf = (set: ScoutSet): ScoutSide => {
    const last = set.rallies[set.rallies.length - 1];
    return last ? last.winner : set.firstServer;
  };

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
    // Chi era in campo quando è cominciato lo scambio; al primo del set è la formazione di partenza.
    const court = snapshots();
    if (set.rallies.length === 0) {
      starts.us = courts.us;
      starts.opp = courts.opp;
      set.lineups = court;
    }
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
      court,
    };
    set.rallies.push(rally);
    rallies.push(rally);
    set.score = score;
    // L'inizio del set è il primo tocco segnato, se ce ne sono: la durata stimata è meno per difetto.
    set.startedAt ??= touches.length > 0 ? touches[0].at : at;
    set.endedAt = at;
    // Dopo lo scambio: chi vince conquista la battuta (e ruota) o la tiene; la libero si riallinea.
    for (const side of SIDES) {
      const lineup = courts[side];
      if (!lineup) continue;
      const won = winner === side;
      const wasServing = rally.server === side;
      courts[side] = lineupAfterRally(lineup, { players: 6, useLibero: true, won, wasServing });
      if (won && !wasServing) rotations[side] += 1;
    }
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
    } else if (event.type === "lineup" && event.positions.every((id) => !id)) {
      // Nessuna giocatrice: la squadra non si segue più (la formazione si «svuota»).
      courts[event.side] = null;
      if (cur.rallies.length === 0) {
        starts[event.side] = null;
        rotations[event.side] = 0;
      }
    } else if (event.type === "lineup") {
      // La formazione di una squadra: a set non cominciato è quella di partenza, dopo corregge dove stanno ora.
      const lineup = refreshLibero(
        {
          positions: Array.from({ length: 6 }, (_, i) => event.positions[i] ?? ""),
          liberoName: event.libero ?? "",
          hostNames: [event.hosts[0] ?? "", event.hosts[1] ?? ""] as [string, string],
          liberoActiveFor: null,
        },
        6,
        true,
        serverOf(cur) === event.side,
      );
      courts[event.side] = lineup;
      if (cur.rallies.length === 0) {
        starts[event.side] = lineup;
        rotations[event.side] = 0;
      }
    } else if (event.type === "sub") {
      const court = courts[event.side];
      if (court && !substitutionProblemFor(court, event.position, event.player, true)) {
        const { lineup, outgoing, counts } = substituteLineup(court, event.position, event.player, {
          players: 6,
          useLibero: true,
          isServing: serverOf(cur) === event.side,
        });
        courts[event.side] = lineup;
        if (counts) {
          cur.subs.push({ id: event.id, at: event.at, side: event.side, position: event.position, out: outgoing, in: event.player, score: { ...cur.score } });
        }
      }
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
        // Il set dopo riparte dalla formazione di partenza (a meno che non se ne segni un'altra).
        for (const side of SIDES) {
          const start = starts[side];
          if (start) courts[side] = refreshLibero({ ...start, liberoActiveFor: null }, 6, true, event.nextServer === side);
          rotations[side] = 0;
        }
      }
    }
  }

  return { sets, rallies, setsWon, current: cur, decided, pending: cur ? pending : [], court: snapshots() };
}

/** Il set in corso ha raggiunto il limite con due punti di scarto: si può chiuderlo. */
export function suggestedSetEnd(view: ScoutView, settings: ScoutSettings): { winner: ScoutSide; score: ScoutScore } | null {
  const cur = view.current;
  if (!cur) return null;
  if (!isSetOver(cur.score, setTarget(settings, cur.n))) return null;
  return { winner: cur.score.us > cur.score.opp ? "us" : "opp", score: cur.score };
}

/** Di norma i set si alternano: chi ha battuto per primo nel set appena chiuso batte per secondo nel successivo. */
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
