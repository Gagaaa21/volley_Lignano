import { deriveScout, type ScoutScore, type ScoutSet, type ScoutView } from "./derive";
import { isManualPlayer } from "./actions";
import { effectiveLevel, hasTouches, higherLevel } from "./levels";
import { effectiveTouches, isPositiveGrade } from "./touches";
import {
  otherSide,
  SCOUT_GRADES,
  SCOUT_HOWS,
  type ScoutData,
  type ScoutGrade,
  type ScoutHow,
  type ScoutLevel,
  type ScoutPlayer,
  type ScoutRoster,
  type ScoutSide,
  type ScoutTouch,
} from "./types";

/**
 * Dal registro degli scambi al tabellino. Il livello Base conta chi ha fatto
 * punto e come, gli errori, i break point (punti fatti in battuta) e i cambi
 * palla (punti fatti in ricezione). Con i livelli «Con ricezioni» e «Completo»
 * si contano anche i tocchi segnati (ricezioni con voto, attacchi, difese…):
 * i tocchi di uno scambio chiuso a mano («Punto loro: ace») si ricavano dal suo
 * esito (vedi effectiveTouches), così i due modi di segnare si sommano.
 */

export type GradeCounts = Record<ScoutGrade, number>;

export function emptyGrades(): GradeCounts {
  return Object.fromEntries(SCOUT_GRADES.map((grade) => [grade, 0])) as GradeCounts;
}

/** Una zona del campo: quanti tocchi, quanti buoni e quanti persi (per l'attacco: punti, e errori o murati). */
export interface ZoneCell {
  total: number;
  good: number;
  lost: number;
}

/** Le sei zone del campo (1-6), vuote. */
export type ZoneGrid = Record<number, ZoneCell>;

export function emptyZones(): ZoneGrid {
  return Object.fromEntries([1, 2, 3, 4, 5, 6].map((zone) => [zone, { total: 0, good: 0, lost: 0 }]));
}

/** I numeri che servono solo ai livelli con i tocchi: tutti zero se non sono stati segnati. */
export interface PlayerDetail {
  /** Battute segnate (ace ed errori compresi). */
  serves: number;
  /** Ricezioni per voto e il loro totale. */
  reception: GradeCounts;
  receptions: number;
  /** Attacchi segnati: punti, errori, murati e quelli in cui la palla è rimasta in gioco. */
  attacks: number;
  /** Tocchi a muro senza punto (i punti a muro sono in `stuffs`). */
  blockTouches: number;
  /** Difese riuscite (ogni voto tranne l'errore) e sbagliate. */
  digs: number;
  digErrors: number;
  /** Alzate segnate, e quelle sbagliate. */
  sets: number;
  setErrors: number;
}

export function emptyDetail(): PlayerDetail {
  return {
    serves: 0,
    reception: emptyGrades(),
    receptions: 0,
    attacks: 0,
    blockTouches: 0,
    digs: 0,
    digErrors: 0,
    sets: 0,
    setErrors: 0,
  };
}

export function addDetail(into: PlayerDetail, from: PlayerDetail): PlayerDetail {
  into.serves += from.serves;
  into.receptions += from.receptions;
  into.attacks += from.attacks;
  into.blockTouches += from.blockTouches;
  into.digs += from.digs;
  into.digErrors += from.digErrors;
  into.sets += from.sets;
  into.setErrors += from.setErrors;
  for (const grade of SCOUT_GRADES) into.reception[grade] += from.reception[grade];
  return into;
}

export interface RotationRow {
  /** 1 = la rotazione con cui si comincia il set. */
  rotation: number;
  served: number;
  breakPoints: number;
  received: number;
  sideOuts: number;
}

/** Quello che si ricava dai tocchi per una squadra. */
export interface SideAnalysis {
  reception: GradeCounts;
  receptions: number;
  /** Per ogni voto della ricezione: quante volte si è ricevuto così e quante volte lo scambio è stato vinto (cambio palla). */
  sideOutByGrade: Record<ScoutGrade, { total: number; won: number }>;
  zones: { reception: ZoneGrid; dig: ZoneGrid; attack: ZoneGrid };
  rotations: RotationRow[];
}

export function emptyAnalysis(): SideAnalysis {
  return {
    reception: emptyGrades(),
    receptions: 0,
    sideOutByGrade: Object.fromEntries(SCOUT_GRADES.map((grade) => [grade, { total: 0, won: 0 }])) as SideAnalysis["sideOutByGrade"],
    zones: { reception: emptyZones(), dig: emptyZones(), attack: emptyZones() },
    rotations: [1, 2, 3, 4, 5, 6].map((rotation) => ({ rotation, served: 0, breakPoints: 0, received: 0, sideOuts: 0 })),
  };
}

export function addAnalysis(into: SideAnalysis, from: SideAnalysis): SideAnalysis {
  into.receptions += from.receptions;
  for (const grade of SCOUT_GRADES) {
    into.reception[grade] += from.reception[grade];
    into.sideOutByGrade[grade].total += from.sideOutByGrade[grade].total;
    into.sideOutByGrade[grade].won += from.sideOutByGrade[grade].won;
  }
  for (const kind of ["reception", "dig", "attack"] as const) {
    for (let zone = 1; zone <= 6; zone++) {
      into.zones[kind][zone].total += from.zones[kind][zone].total;
      into.zones[kind][zone].good += from.zones[kind][zone].good;
      into.zones[kind][zone].lost += from.zones[kind][zone].lost;
    }
  }
  from.rotations.forEach((row, i) => {
    into.rotations[i].served += row.served;
    into.rotations[i].breakPoints += row.breakPoints;
    into.rotations[i].received += row.received;
    into.rotations[i].sideOuts += row.sideOuts;
  });
  return into;
}

/** Quante zone hanno almeno un tocco: se zero, la mappa non si mostra. */
export function zonedTouches(grid: ZoneGrid): number {
  return Object.values(grid).reduce((sum, cell) => sum + cell.total, 0);
}

export function sumDetails(players: Pick<PlayerStats, "detail">[]): PlayerDetail {
  return players.reduce((total, p) => addDetail(total, p.detail), emptyDetail());
}

export type HowCounts = Record<ScoutHow, number>;

export function emptyCounts(): HowCounts {
  return Object.fromEntries(SCOUT_HOWS.map((how) => [how, 0])) as HowCounts;
}

/** Percentuale intera, null se non c'è nulla su cui calcolarla. */
export function percent(part: number, total: number): number | null {
  return total > 0 ? Math.round((part / total) * 100) : null;
}

/** Id della riga «Non assegnato»: scambi segnati senza dire chi. */
export const UNASSIGNED_ID = "?";

export interface PlayerStats {
  id: string;
  name: string;
  number: string | null;
  libero: boolean;
  side: ScoutSide;
  /** Punti fatti da lei: attacchi vincenti + muri + ace. */
  points: number;
  /** Di quei punti, quelli fatti mentre la sua squadra batteva (break point). */
  bp: number;
  kills: number;
  stuffs: number;
  aces: number;
  serveErrors: number;
  receptionErrors: number;
  attackErrors: number;
  blockErrors: number;
  /** Alzata, difesa e falli fischiati (rete, invasione, doppia, trattenuta…). */
  otherErrors: number;
  errors: number;
  /** Suoi attacchi murati dall'avversaria. */
  blocked: number;
  /** Punti fatti meno errori e attacchi murati (il «V-P» del tabellino). */
  balance: number;
  /** Battute, ricezioni, attacchi, difese… segnati: servono ai livelli con i tocchi. */
  detail: PlayerDetail;
}

export interface TeamStats {
  side: ScoutSide;
  points: number;
  /** Punti fatti con un attacco, con un muro, con un ace. */
  attack: number;
  block: number;
  ace: number;
  /** Errori commessi dalla squadra, per tipo (sono i punti dell'avversaria). */
  committed: HowCounts;
  errors: number;
  /** Scambi in cui batteva, e punti fatti in quegli scambi (break point). */
  served: number;
  breakPoints: number;
  /** Scambi in cui riceveva, e punti fatti in quegli scambi (cambio palla). */
  received: number;
  sideOuts: number;
  /** Più punti consecutivi in un set. */
  longestRun: number;
}

export interface SetSummary {
  n: number;
  score: ScoutScore;
  winner: ScoutSide | null;
  closed: boolean;
  firstServer: ScoutSide;
  rallies: number;
  /** Durata stimata in minuti dal primo all'ultimo punto: null se non si può dire. */
  minutes: number | null;
  /** Noi meno loro dopo ogni punto, dallo 0-0: serve al grafico dell'andamento. */
  flow: number[];
  longestRun: ScoutScore;
}

export interface ScoutStats {
  us: TeamStats;
  opp: TeamStats;
  players: Record<ScoutSide, PlayerStats[]>;
  sets: SetSummary[];
  /** Scambi considerati (tutti, o solo quelli del set scelto). */
  rallies: number;
  /** Ricezioni, zone e rotazioni per squadra (vuoto se non sono stati segnati i tocchi). */
  analysis: Record<ScoutSide, SideAnalysis>;
}

// ── singole giocatrici ──────────────────────────────────────────────────

function emptyPlayer(side: ScoutSide, info: Pick<ScoutPlayer, "id" | "name" | "number" | "libero">): PlayerStats {
  return {
    id: info.id,
    name: info.name,
    number: info.number,
    libero: info.libero,
    side,
    points: 0,
    bp: 0,
    kills: 0,
    stuffs: 0,
    aces: 0,
    serveErrors: 0,
    receptionErrors: 0,
    attackErrors: 0,
    blockErrors: 0,
    otherErrors: 0,
    errors: 0,
    blocked: 0,
    balance: 0,
    detail: emptyDetail(),
  };
}

/** Ha fatto o subìto qualcosa: chi non compare in nessuno scambio non entra nel tabellino. */
export function hasActivity(p: PlayerStats): boolean {
  const d = p.detail;
  return p.points + p.errors + p.blocked + d.serves + d.receptions + d.attacks + d.blockTouches + d.digs + d.sets > 0;
}

function finishPlayer(p: PlayerStats): PlayerStats {
  const points = p.kills + p.stuffs + p.aces;
  const errors = p.serveErrors + p.receptionErrors + p.attackErrors + p.blockErrors + p.otherErrors;
  return { ...p, points, errors, balance: points - errors - p.blocked };
}

/** Per numero di maglia (chi non ce l'ha in fondo), poi per nome. */
function compareLines(a: PlayerStats, b: PlayerStats): number {
  const na = a.number === null ? Number.POSITIVE_INFINITY : Number(a.number);
  const nb = b.number === null ? Number.POSITIVE_INFINITY : Number(b.number);
  return na - nb || a.name.localeCompare(b.name, "it");
}

function addError(line: PlayerStats, how: ScoutHow) {
  if (how === "serveError") line.serveErrors += 1;
  else if (how === "receptionError") line.receptionErrors += 1;
  else if (how === "attackError") line.attackErrors += 1;
  else if (how === "blockError") line.blockErrors += 1;
  else line.otherErrors += 1;
}

// ── squadre ─────────────────────────────────────────────────────────────

export function emptyTeam(side: ScoutSide): TeamStats {
  return {
    side,
    points: 0,
    attack: 0,
    block: 0,
    ace: 0,
    committed: emptyCounts(),
    errors: 0,
    served: 0,
    breakPoints: 0,
    received: 0,
    sideOuts: 0,
    longestRun: 0,
  };
}

/** Punti fatti perché l'avversaria ha sbagliato o ha commesso un fallo. */
export function pointsFromErrors(team: TeamStats): number {
  return team.points - team.attack - team.block - team.ace;
}

export function addTeamStats(a: TeamStats, b: TeamStats): TeamStats {
  const committed = emptyCounts();
  for (const how of SCOUT_HOWS) committed[how] = a.committed[how] + b.committed[how];
  return {
    side: a.side,
    points: a.points + b.points,
    attack: a.attack + b.attack,
    block: a.block + b.block,
    ace: a.ace + b.ace,
    committed,
    errors: a.errors + b.errors,
    served: a.served + b.served,
    breakPoints: a.breakPoints + b.breakPoints,
    received: a.received + b.received,
    sideOuts: a.sideOuts + b.sideOuts,
    longestRun: Math.max(a.longestRun, b.longestRun),
  };
}

// ── set ─────────────────────────────────────────────────────────────────

/** Il primo punto arriva a fine del primo scambio e l'ultimo a fine set: la durata è una stima per difetto. */
export function estimateMinutes(set: ScoutSet): number | null {
  if (set.startedAt === null || set.endedAt === null || set.rallies.length < 2) return null;
  const minutes = Math.round((set.endedAt - set.startedAt) / 60_000);
  return minutes >= 1 ? minutes : null;
}

/** I numeri di una squadra in un set, per il resoconto di fine set (vedi toPublicScoutScore). */
export interface SetRecapCounts {
  /** Punti fatti con un attacco, con un muro, con un ace. */
  attack: number;
  block: number;
  ace: number;
  /** Punti avuti da errori o falli dell'avversaria. */
  gifts: number;
  /** Più punti consecutivi nel set. */
  run: number;
  /** Time-out usati nel set. */
  timeouts: number;
}

/**
 * I numeri di ogni squadra in un set: stessa regola di computeStats (il punto è «sul campo» se vince chi ha agito, altrimenti
 * è un regalo dell'avversaria), così attacchi + muri + ace + regali fanno il punteggio del set.
 */
export function setRecapCounts(set: ScoutSet): Record<ScoutSide, SetRecapCounts> {
  const empty = (): SetRecapCounts => ({ attack: 0, block: 0, ace: 0, gifts: 0, run: 0, timeouts: 0 });
  const counts: Record<ScoutSide, SetRecapCounts> = { us: empty(), opp: empty() };
  let streakSide: ScoutSide | null = null;
  let streak = 0;
  for (const rally of set.rallies) {
    const team = counts[rally.winner];
    if (rally.actor === rally.winner) {
      if (rally.how === "attack") team.attack += 1;
      else if (rally.how === "block") team.block += 1;
      else team.ace += 1;
    } else {
      team.gifts += 1;
    }
    streak = rally.winner === streakSide ? streak + 1 : 1;
    streakSide = rally.winner;
    if (streak > team.run) team.run = streak;
  }
  for (const side of ["us", "opp"] as const) counts[side].timeouts = set.timeouts.filter((timeout) => timeout.side === side).length;
  return counts;
}

function summarizeSet(set: ScoutSet): SetSummary {
  const flow = [0];
  const longestRun: ScoutScore = { us: 0, opp: 0 };
  let streakSide: ScoutSide | null = null;
  let streak = 0;
  for (const rally of set.rallies) {
    flow.push(rally.score.us - rally.score.opp);
    if (rally.winner === streakSide) {
      streak += 1;
    } else {
      streakSide = rally.winner;
      streak = 1;
    }
    if (streak > longestRun[rally.winner]) longestRun[rally.winner] = streak;
  }
  return {
    n: set.n,
    score: set.score,
    winner: set.winner,
    closed: set.closed,
    firstServer: set.firstServer,
    rallies: set.rallies.length,
    minutes: estimateMinutes(set),
    flow,
    longestRun,
  };
}

// ── tabellino ───────────────────────────────────────────────────────────

export interface StatsOptions {
  /** Solo i punti di questo set (1 = primo); senza, tutta la partita. */
  set?: number | null;
}

export function computeStats(view: ScoutView, roster: ScoutRoster, options: StatsOptions = {}): ScoutStats {
  const only = options.set ?? null;
  const sets = view.sets.map(summarizeSet);
  const included = only === null ? sets : sets.filter((s) => s.n === only);
  const rallies = only === null ? view.rallies : view.rallies.filter((r) => r.set === only);

  const teams: Record<ScoutSide, TeamStats> = { us: emptyTeam("us"), opp: emptyTeam("opp") };
  const lines: Record<ScoutSide, Map<string, PlayerStats>> = { us: new Map(), opp: new Map() };
  const unassigned: Record<ScoutSide, PlayerStats> = {
    us: emptyPlayer("us", { id: UNASSIGNED_ID, name: "Non assegnato", number: null, libero: false }),
    opp: emptyPlayer("opp", { id: UNASSIGNED_ID, name: "Non assegnato", number: null, libero: false }),
  };
  for (const side of ["us", "opp"] as const) {
    for (const p of roster[side]) lines[side].set(p.id, emptyPlayer(side, p));
  }
  /** La riga della giocatrice; se non c'è (o non è in rosa) quella «Non assegnato» della squadra. */
  const lineOf = (side: ScoutSide, id: string | null): PlayerStats => (id !== null ? lines[side].get(id) : undefined) ?? unassigned[side];
  const analysis: Record<ScoutSide, SideAnalysis> = { us: emptyAnalysis(), opp: emptyAnalysis() };

  /** Un tocco nelle colonne di chi l'ha fatto e nelle mappe della sua squadra. */
  function countTouch(touch: ScoutTouch) {
    const line = lineOf(touch.side, touch.player);
    const d = line.detail;
    const zones = analysis[touch.side].zones;
    const lost = touch.grade === "=" || touch.grade === "/";
    switch (touch.skill) {
      case "serve":
        d.serves += 1;
        break;
      case "reception":
        d.reception[touch.grade] += 1;
        d.receptions += 1;
        analysis[touch.side].reception[touch.grade] += 1;
        analysis[touch.side].receptions += 1;
        if (touch.zone) addToZone(zones.reception, touch.zone, isPositiveGrade(touch.grade), lost);
        break;
      case "set":
        d.sets += 1;
        if (touch.grade === "=") d.setErrors += 1;
        break;
      case "attack":
        d.attacks += 1;
        // Un attacco fermato dal muro è un attacco murato (con il muro vincente si riclassifica da solo, vedi effectiveTouches).
        if (touch.grade === "/") line.blocked += 1;
        if (touch.zone) addToZone(zones.attack, touch.zone, touch.grade === "#", lost);
        break;
      case "block":
        if (touch.grade === "+") d.blockTouches += 1;
        break;
      case "dig":
        if (touch.grade === "=") d.digErrors += 1;
        else d.digs += 1;
        if (touch.zone) addToZone(zones.dig, touch.zone, isPositiveGrade(touch.grade), lost);
        break;
    }
  }

  for (const r of rallies) {
    const receiver = otherSide(r.server);
    teams[r.server].served += 1;
    teams[receiver].received += 1;
    teams[r.winner].points += 1;
    if (r.winner === r.server) teams[r.server].breakPoints += 1;
    else teams[r.winner].sideOuts += 1;

    const line = lineOf(r.actor, r.player);
    if (r.winner === r.actor) {
      // Punto «sul campo»: attacco, muro o ace di chi ha agito.
      const bp = r.server === r.actor ? 1 : 0;
      if (r.how === "attack") {
        teams[r.actor].attack += 1;
        line.kills += 1;
      } else if (r.how === "block") {
        teams[r.actor].block += 1;
        line.stuffs += 1;
      } else {
        teams[r.actor].ace += 1;
        line.aces += 1;
      }
      line.bp += bp;
    } else {
      teams[r.actor].committed[r.how] += 1;
      teams[r.actor].errors += 1;
      addError(line, r.how);
    }

    const touches = effectiveTouches(r);
    for (const touch of touches) countTouch(touch);
    // Il cambio palla in base a come si è ricevuto: la prima ricezione segnata di chi riceveva.
    const reception = touches.find((t) => t.skill === "reception" && t.side === receiver);
    if (reception) {
      const cell = analysis[receiver].sideOutByGrade[reception.grade];
      cell.total += 1;
      if (r.winner === receiver) cell.won += 1;
    }
  }

  // Le rotazioni: ogni set riparte dalla rotazione 1 e una squadra ruota quando recupera la battuta; le correzioni a mano
  // contano (la rotazione di ogni scambio la ricava derive.ts, vedi ScoutRally.rotation).
  for (const set of view.sets) {
    if (only !== null && set.n !== only) continue;
    for (const r of set.rallies) {
      const serving = analysis[r.server].rotations[r.rotation[r.server] - 1];
      serving.served += 1;
      if (r.winner === r.server) serving.breakPoints += 1;
      const other = otherSide(r.server);
      const receiving = analysis[other].rotations[r.rotation[other] - 1];
      receiving.received += 1;
      if (r.winner === other) receiving.sideOuts += 1;
    }
  }

  for (const side of ["us", "opp"] as const) {
    teams[side].longestRun = included.reduce((best, s) => Math.max(best, s.longestRun[side]), 0);
  }

  const players = {} as Record<ScoutSide, PlayerStats[]>;
  for (const side of ["us", "opp"] as const) {
    const rows = [...lines[side].values()].map(finishPlayer).sort(compareLines);
    const extra = finishPlayer(unassigned[side]);
    // «Non assegnato» compare solo se serve a far tornare i conti della squadra.
    players[side] = hasActivity(extra) ? [...rows, extra] : rows;
  }

  return { us: teams.us, opp: teams.opp, players, sets, rallies: rallies.length, analysis };
}

/** Un tocco in una zona: `good` se è andato bene, `lost` se è costato la palla. */
function addToZone(grid: ZoneGrid, zone: number, good: boolean, lost: boolean) {
  const cell = grid[zone];
  if (!cell) return;
  cell.total += 1;
  if (good) cell.good += 1;
  if (lost) cell.lost += 1;
}

/** Comodo per chi ha solo i dati salvati. */
export function statsOf(data: Pick<ScoutData, "settings" | "events" | "roster">, options: StatsOptions = {}): ScoutStats {
  return computeStats(deriveScout(data), data.roster, options);
}

// ── stagione ────────────────────────────────────────────────────────────

export interface SeasonPlayer extends PlayerStats {
  /** Partite scoutizzate in cui ha fatto o subìto almeno un'azione. */
  matches: number;
}

export interface SeasonStats {
  /** Partite con almeno un punto segnato. */
  matches: number;
  rallies: number;
  players: SeasonPlayer[];
  us: TeamStats;
  opp: TeamStats;
  /**
   * Partite in cui si sono segnati dei tocchi (ricezioni, attacchi…): i numeri
   * di dettaglio (ricezione, attacco, difese) contano solo queste, perché in
   * quelle a «Base» mancano.
   */
  detailMatches: number;
  /** Il livello più alto tra quelle partite: decide quali colonne mostrare. */
  level: ScoutLevel;
  analysis: Record<ScoutSide, SideAnalysis>;
}

const SUMMED_FIELDS = [
  "points",
  "bp",
  "kills",
  "stuffs",
  "aces",
  "serveErrors",
  "receptionErrors",
  "attackErrors",
  "blockErrors",
  "otherErrors",
  "errors",
  "blocked",
  "balance",
] as const satisfies readonly (keyof PlayerStats)[];

function normalizedName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Una atleta del registro è la stessa in tutte le partite (stesso id); una
 * scritta a mano non ha un id che duri tra partite diverse, quindi si
 * riconosce dal nome.
 */
function seasonKey(p: Pick<PlayerStats, "id" | "name">): string {
  return isManualPlayer(p.id) ? `n:${normalizedName(p.name)}` : p.id;
}

/** Somma gli scout di più partite: totali della squadra e riga per ogni atleta nostra (più «Non assegnato» se serve). */
export function aggregateSeason(items: Array<Pick<ScoutData, "settings" | "events" | "roster">>): SeasonStats {
  let matches = 0;
  let rallies = 0;
  let us = emptyTeam("us");
  let opp = emptyTeam("opp");
  const players = new Map<string, SeasonPlayer>();
  const analysis: Record<ScoutSide, SideAnalysis> = { us: emptyAnalysis(), opp: emptyAnalysis() };
  let detailMatches = 0;
  let level: ScoutLevel = "base";

  for (const item of items) {
    const stats = statsOf(item);
    if (stats.rallies === 0) continue;
    matches += 1;
    rallies += stats.rallies;
    us = addTeamStats(us, stats.us);
    opp = addTeamStats(opp, stats.opp);
    const detailed = hasTouches(item);
    if (detailed) {
      detailMatches += 1;
      level = higherLevel(level, effectiveLevel(item));
      addAnalysis(analysis.us, stats.analysis.us);
      addAnalysis(analysis.opp, stats.analysis.opp);
    }

    for (const line of stats.players.us) {
      if (!hasActivity(line)) continue;
      const key = seasonKey(line);
      const total = players.get(key) ?? { ...emptyPlayer("us", line), matches: 0 };
      for (const field of SUMMED_FIELDS) total[field] += line[field];
      if (detailed) addDetail(total.detail, line.detail);
      total.matches += 1;
      // Nome e numero più recenti (l'elenco è dalla partita più vecchia alla più nuova).
      total.name = line.name;
      total.number = line.number;
      total.libero = total.libero || line.libero;
      players.set(key, total);
    }
  }

  // «Non assegnato» (punti segnati senza dire chi) in fondo: serve a far tornare i totali della squadra.
  const rows = [...players.values()].sort(
    (a, b) => Number(a.id === UNASSIGNED_ID) - Number(b.id === UNASSIGNED_ID) || compareLines(a, b),
  );
  return { matches, rallies, players: rows, us, opp, detailMatches, level, analysis };
}
