import { deriveScout, setTarget, type ScoutRally, type ScoutScore, type ScoutSet, type ScoutView } from "./derive";
import { effectiveLevel } from "./levels";
import { isServeHow } from "./rules";
import {
  computeStats,
  emptyGrades,
  estimateMinutes,
  hasActivity,
  percent,
  pointsFromErrors,
  type PlayerDetail,
  type PlayerStats,
  type SideAnalysis,
  type TeamStats,
} from "./stats";
import { otherSide, SCOUT_GRADES, type ScoutData, type ScoutLevel, type ScoutSide } from "./types";

/**
 * Il tabellino come quello delle federazioni e delle leghe (gli scout ufficiali, tipo Data Volley): una tabella per squadra con
 * una riga per giocatrice (posizione di partenza in ogni set, punti, battuta, ricezione, attacco, muro), il totale e i numeri set
 * per set; sopra i set con durata, parziali e finali; sotto i punti per rotazione, ricezioni e battute per punto, e il cambio
 * palla dopo la ricezione. Tutto si ricava dagli scambi già segnati, quindi vale anche per le partite scoutizzate prima.
 *
 * Quello che il livello non segna non si inventa: è `null` nei numeri (e «–» sul foglio), mentre zero è zero (« . »).
 */

/** I numeri di una riga: una giocatrice, il totale della squadra o un set. `null` = non si segna a questo livello. */
export interface SheetNumbers {
  points: number;
  bp: number;
  balance: number;
  serves: number | null;
  serveErrors: number;
  aces: number;
  receptions: number | null;
  receptionErrors: number;
  /** Ricezioni positive (# e +) e perfette (#) su quelle segnate: null se non ce n'è nessuna. */
  positivePct: number | null;
  perfectPct: number | null;
  attackErrors: number;
  blocked: number;
  kills: number;
  blocks: number;
}

/** In un set: posizione di partenza (1-6), «in» se è entrata dopo (o è la libero), null se non ha giocato. */
export type SheetSetMark = number | "in" | null;

export interface SheetLine extends SheetNumbers {
  id: string;
  number: string | null;
  name: string;
  libero: boolean;
  /** Un segno per ogni set giocato, nell'ordine. */
  sets: SheetSetMark[];
  /** Ha fatto o subìto almeno un'azione. */
  active: boolean;
}

/** I punti vinti in un set, divisi come nei tabellini ufficiali: ace, attacco, muro, errori dell'avversaria. */
export interface SheetPointsWon {
  ace: number;
  attack: number;
  block: number;
  gifts: number;
}

export interface SheetSetRow extends SheetNumbers {
  n: number;
  won: SheetPointsWon;
}

export interface SheetRotation {
  /** 1 = la rotazione con cui si comincia il set. */
  rotation: number;
  won: number;
  lost: number;
}

export interface SheetTeam {
  side: ScoutSide;
  /** Si sa chi batteva (formazione seguita o battute segnate): allora c'è il totale delle battute per giocatrice. */
  tracksServes: boolean;
  /** Le ricezioni di questa squadra si segnano: solo le nostre, a livello «Con ricezioni». */
  tracksReceptions: boolean;
  /** I set in cui ha battuto per prima. */
  firstServes: number[];
  lines: SheetLine[];
  total: SheetNumbers;
  perSet: SheetSetRow[];
  won: SheetPointsWon;
  rotations: SheetRotation[];
  /** Battute dell'avversaria da ricevere (quelle sbagliate no) e punti fatti in ricezione (cambio palla, senza le battute sbagliate). */
  receptionsFaced: number;
  sideOutPoints: number;
  /** Battute e punti fatti in battuta (break point). */
  serves: number;
  breakPoints: number;
  /** Il cambio palla dopo una ricezione positiva o negativa, quando si segnano le ricezioni. */
  sideOutByReception: { positive: { total: number; won: number }; negative: { total: number; won: number } } | null;
}

export interface SheetSet {
  n: number;
  minutes: number | null;
  /** Il punteggio quando una delle due arriva a 8, 16 e 21 (a 8 nel set decisivo), come i parziali dei tabellini ufficiali. */
  partials: ScoutScore[];
  final: ScoutScore;
  winner: ScoutSide | null;
  closed: boolean;
}

export interface ScoutSheet {
  level: ScoutLevel;
  sets: SheetSet[];
  /** Somma delle durate stimate: null se di qualche set non si sa. */
  totalMinutes: number | null;
  totalPoints: ScoutScore;
  setsWon: ScoutScore;
  decided: boolean;
  us: SheetTeam;
  opp: SheetTeam;
}


/** Le soglie dei parziali: 8, 16 e 21 nei set a 25, 8 nel set corto (a 15). */
export function partialThresholds(target: number): number[] {
  return target >= 25 ? [8, 16, 21] : [8];
}

/** Il punteggio nel momento in cui una delle due squadre arriva per prima a ogni soglia. */
export function partialsOf(set: Pick<ScoutSet, "rallies">, target: number): ScoutScore[] {
  const out: ScoutScore[] = [];
  const thresholds = partialThresholds(target);
  let next = 0;
  for (const rally of set.rallies) {
    while (next < thresholds.length && Math.max(rally.score.us, rally.score.opp) >= thresholds[next]) {
      out.push({ ...rally.score });
      next += 1;
    }
  }
  return out;
}

/**
 * Chi ha battuto in uno scambio: la battuta segnata, altrimenti chi ha fatto l'ace o sbagliato la battuta, altrimenti chi era in
 * posizione 1 (con la formazione). `undefined` se non si sa; `null` se c'era la battuta ma senza dire chi.
 */
export function serverOf(rally: Pick<ScoutRally, "touches" | "server" | "closedBy" | "how" | "actor" | "player" | "court">): string | null | undefined {
  const serve = rally.touches.find((touch) => touch.skill === "serve" && touch.side === rally.server);
  if (serve) return serve.player;
  if (rally.closedBy === "outcome" && isServeHow(rally.how) && rally.actor === rally.server && rally.player) return rally.player;
  const id = rally.court[rally.server]?.positions[0];
  return id ? id : undefined;
}

/** Quello che serve di una riga del tabellino di sempre (una giocatrice, o la somma di una squadra). */
type RowInput = Pick<PlayerStats, "points" | "bp" | "balance" | "aces" | "serveErrors" | "receptionErrors" | "kills" | "attackErrors" | "blocked" | "stuffs"> & {
  detail: Pick<PlayerDetail, "receptions" | "reception">;
};

/** I numeri di una riga a partire da quelli del tabellino di sempre, con quello che il livello non segna a null. */
function numbersOf(p: RowInput, serves: number | null, tracksReceptions: boolean): SheetNumbers {
  const receptions = p.detail.receptions;
  const positive = p.detail.reception["#"] + p.detail.reception["+"];
  return {
    points: p.points,
    bp: p.bp,
    balance: p.balance,
    serves,
    serveErrors: p.serveErrors,
    aces: p.aces,
    receptions: tracksReceptions ? receptions : null,
    receptionErrors: p.receptionErrors,
    positivePct: tracksReceptions ? percent(positive, receptions) : null,
    perfectPct: tracksReceptions ? percent(p.detail.reception["#"], receptions) : null,
    attackErrors: p.attackErrors,
    blocked: p.blocked,
    kills: p.kills,
    blocks: p.stuffs,
  };
}

/** La somma delle righe di una squadra (le percentuali si rifanno sui totali). */
function sumOf(players: PlayerStats[], serves: number, tracksReceptions: boolean): SheetNumbers {
  const total: RowInput = {
    points: 0,
    bp: 0,
    balance: 0,
    aces: 0,
    serveErrors: 0,
    receptionErrors: 0,
    kills: 0,
    attackErrors: 0,
    blocked: 0,
    stuffs: 0,
    detail: { receptions: 0, reception: emptyGrades() },
  };
  for (const p of players) {
    total.points += p.points;
    total.bp += p.bp;
    total.balance += p.balance;
    total.aces += p.aces;
    total.serveErrors += p.serveErrors;
    total.receptionErrors += p.receptionErrors;
    total.kills += p.kills;
    total.attackErrors += p.attackErrors;
    total.blocked += p.blocked;
    total.stuffs += p.stuffs;
    total.detail.receptions += p.detail.receptions;
    for (const grade of SCOUT_GRADES) total.detail.reception[grade] += p.detail.reception[grade];
  }
  return numbersOf(total, serves, tracksReceptions);
}

function wonOf(team: TeamStats): SheetPointsWon {
  return { ace: team.ace, attack: team.attack, block: team.block, gifts: pointsFromErrors(team) };
}

/** Chi ha fatto o subìto qualcosa in uno scambio: per i set di chi non ha la formazione segnata. */
function involved(rally: ScoutRally): { side: ScoutSide; id: string }[] {
  const out: { side: ScoutSide; id: string }[] = [];
  if (rally.player) out.push({ side: rally.actor, id: rally.player });
  if (rally.victim) out.push({ side: otherSide(rally.actor), id: rally.victim });
  for (const touch of rally.touches) if (touch.player) out.push({ side: touch.side, id: touch.player });
  return out;
}

/** Il segno di una giocatrice in un set: da dove è partita, se è entrata, o niente. */
function setMark(set: ScoutSet, side: ScoutSide, id: string, played: Set<string>): SheetSetMark {
  const lineup = set.lineups[side];
  if (lineup) {
    const index = lineup.positions.indexOf(id);
    if (index >= 0) return index + 1;
    if (lineup.libero === id) return "in";
    if (set.subs.some((sub) => sub.side === side && sub.in === id)) return "in";
    return null;
  }
  return played.has(id) ? "in" : null;
}

/** Il cambio palla dopo una ricezione positiva (# +) o negativa (! - /), dai voti segnati. */
function sideOutByReception(analysis: SideAnalysis): NonNullable<SheetTeam["sideOutByReception"]> {
  const sum = (grades: ("#" | "+" | "!" | "-" | "/")[]) =>
    grades.reduce((acc, grade) => ({ total: acc.total + analysis.sideOutByGrade[grade].total, won: acc.won + analysis.sideOutByGrade[grade].won }), { total: 0, won: 0 });
  return { positive: sum(["#", "+"]), negative: sum(["!", "-", "/"]) };
}

function rotationsOf(analysis: SideAnalysis): SheetRotation[] {
  return analysis.rotations.map((row) => {
    const won = row.breakPoints + row.sideOuts;
    return { rotation: row.rotation, won, lost: row.served + row.received - won };
  });
}

/** Il tabellino in stile ufficiale di una partita, da quello che è stato segnato. */
export function buildSheet(data: Pick<ScoutData, "settings" | "events" | "roster">, view: ScoutView = deriveScout(data)): ScoutSheet {
  const level = effectiveLevel(data);
  const playedSets = view.sets.filter((set) => set.rallies.length > 0);
  const stats = computeStats(view, data.roster);
  const perSetStats = playedSets.map((set) => ({ n: set.n, stats: computeStats(view, data.roster, { set: set.n }) }));

  // Le battute di ogni giocatrice, quando si sa chi batteva; e chi ha giocato in ogni set (per chi non ha la formazione).
  const serveCount: Record<ScoutSide, Map<string, number>> = { us: new Map(), opp: new Map() };
  const tracksServes: Record<ScoutSide, boolean> = { us: false, opp: false };
  const playedBySet = new Map<number, Record<ScoutSide, Set<string>>>();
  for (const set of playedSets) {
    const played: Record<ScoutSide, Set<string>> = { us: new Set(), opp: new Set() };
    playedBySet.set(set.n, played);
    for (const rally of set.rallies) {
      for (const { side, id } of involved(rally)) played[side].add(id);
      if (rally.court[rally.server] || rally.touches.some((touch) => touch.skill === "serve" && touch.side === rally.server)) tracksServes[rally.server] = true;
      const server = serverOf(rally);
      if (server) {
        played[rally.server].add(server);
        serveCount[rally.server].set(server, (serveCount[rally.server].get(server) ?? 0) + 1);
      }
    }
  }

  const team = (side: ScoutSide): SheetTeam => {
    const tracksReceptions = level === "ricezioni" && side === "us";
    const teamStats = side === "us" ? stats.us : stats.opp;
    const other = side === "us" ? stats.opp : stats.us;
    const lines: SheetLine[] = stats.players[side].map((p) => ({
      ...numbersOf(p, tracksServes[side] ? (serveCount[side].get(p.id) ?? 0) : null, tracksReceptions),
      id: p.id,
      number: p.number,
      name: p.name,
      libero: p.libero,
      sets: playedSets.map((set) => setMark(set, side, p.id, playedBySet.get(set.n)![side])),
      active: hasActivity(p) || serveCount[side].has(p.id),
    }));
    return {
      side,
      tracksServes: tracksServes[side],
      tracksReceptions,
      firstServes: playedSets.filter((set) => set.firstServer === side).map((set) => set.n),
      lines,
      total: sumOf(stats.players[side], teamStats.served, tracksReceptions),
      perSet: perSetStats.map(({ n, stats: s }) => {
        const t = side === "us" ? s.us : s.opp;
        return { n, won: wonOf(t), ...sumOf(s.players[side], t.served, tracksReceptions) };
      }),
      won: wonOf(teamStats),
      rotations: rotationsOf(stats.analysis[side]),
      receptionsFaced: other.served - other.committed.serveError,
      sideOutPoints: teamStats.sideOuts - other.committed.serveError,
      serves: teamStats.served,
      breakPoints: teamStats.breakPoints,
      sideOutByReception: tracksReceptions ? sideOutByReception(stats.analysis[side]) : null,
    };
  };

  const sets: SheetSet[] = playedSets.map((set) => ({
    n: set.n,
    minutes: estimateMinutes(set),
    partials: partialsOf(set, setTarget(data.settings, set.n)),
    final: { ...set.score },
    winner: set.winner,
    closed: set.closed,
  }));
  const totalMinutes = sets.length > 0 && sets.every((set) => set.minutes !== null) ? sets.reduce((sum, set) => sum + (set.minutes ?? 0), 0) : null;

  return {
    level,
    sets,
    totalMinutes,
    totalPoints: { us: stats.us.points, opp: stats.opp.points },
    setsWon: view.setsWon,
    decided: view.decided,
    us: team("us"),
    opp: team("opp"),
  };
}

/** «ogni 1,64 ricezioni un punto»: quante ne servono in media per un punto, con la virgola; null se di punti non ce n'è. */
export function perPoint(count: number, points: number): string | null {
  if (points <= 0) return null;
  return (count / points).toFixed(2).replace(".", ",");
}

/** La stagione sportiva di una data: da agosto si conta l'anno dopo («2026/2027»). */
export function seasonOf(date: string): string {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  return month >= 8 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
}
