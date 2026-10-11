import { deriveScout, type ScoutScore, type ScoutSet, type ScoutView } from "./derive";
import { isManualPlayer } from "./actions";
import { otherSide, SCOUT_HOWS, type ScoutData, type ScoutHow, type ScoutPlayer, type ScoutRoster, type ScoutSide } from "./types";

/**
 * Dal registro degli scambi al tabellino. Si contano solo cose che lo scout
 * «a punto» sa davvero: chi ha fatto punto e come, gli errori, i break point
 * (punti fatti in battuta) e i cambi palla (punti fatti in ricezione). Le
 * percentuali di attacco e ricezione dei tabellini di Lega non si possono
 * calcolare: servirebbe segnare ogni tocco, non solo come finisce lo scambio.
 */

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
  };
}

/** Ha fatto o subìto qualcosa: chi non compare in nessuno scambio non entra nel tabellino. */
export function hasActivity(p: PlayerStats): boolean {
  return p.points + p.errors + p.blocked > 0;
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
function estimateMinutes(set: ScoutSet): number | null {
  if (set.startedAt === null || set.endedAt === null || set.rallies.length < 2) return null;
  const minutes = Math.round((set.endedAt - set.startedAt) / 60_000);
  return minutes >= 1 ? minutes : null;
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
        lineOf(otherSide(r.actor), r.victim).blocked += 1;
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

  return { us: teams.us, opp: teams.opp, players, sets, rallies: rallies.length };
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

  for (const item of items) {
    const stats = statsOf(item);
    if (stats.rallies === 0) continue;
    matches += 1;
    rallies += stats.rallies;
    us = addTeamStats(us, stats.us);
    opp = addTeamStats(opp, stats.opp);

    for (const line of stats.players.us) {
      if (!hasActivity(line)) continue;
      const key = seasonKey(line);
      const total = players.get(key) ?? { ...emptyPlayer("us", line), matches: 0 };
      for (const field of SUMMED_FIELDS) total[field] += line[field];
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
  return { matches, rallies, players: rows, us, opp };
}
