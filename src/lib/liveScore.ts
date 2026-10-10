import type {
  Category,
  CourtPosition,
  LiveScoreMode,
  LiveScorePlayers,
  LiveScoreState,
  LiveScoreTeamState,
  PublicLiveScore,
  TrainingTeam,
} from "@/lib/types";

/**
 * Regole del tabellone live (src/app/admin/livescore), separate dalla pagina
 * per poterle provare da sole: punti, rotazione, libero, chiusura del set e ciò
 * che il sito pubblico può vedere della diretta. Valgono per ogni formato, dal
 * 2 contro 2 al 6 contro 6.
 */

export type TeamKey = "A" | "B";

/** Colore fisso del blu del club (Squadra A, mai personalizzabile). */
export const HOME_COLOR = "#3a78bb";
/** Giallo acceso per Squadra B in allenamento: non è un'avversaria vera, e un
 * colore vivace e diverso dal blu del club basta a distinguerla — niente da
 * scegliere, sempre lo stesso. */
export const TRAINING_AWAY_COLOR = "#facc15";
/** Colore di partenza per l'avversaria in Partita, finché il coach non ne
 * sceglie uno vero. */
export const DEFAULT_OPPONENT_COLOR = "#475569";
/** In modalità "Partita", Squadra A è sempre il Volley Lignano: etichetta
 * fissa, non un'altra squadra generica da rinominare come in allenamento. */
export const HOME_TEAM_LABEL = "Volley Lignano";
/** Time-out a disposizione di ciascuna squadra per set. */
export const MAX_TIMEOUTS_PER_SET = 2;
/** Set da vincere per aggiudicarsi la partita (al meglio dei 5). */
export const SETS_TO_WIN = 3;

export function teamKeyProp(key: TeamKey): "teamA" | "teamB" {
  return key === "A" ? "teamA" : "teamB";
}

export function otherKey(key: TeamKey): TeamKey {
  return key === "A" ? "B" : "A";
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Testo bianco o quasi-nero a seconda di quanto è chiaro il colore di
 * sfondo (luminanza relativa WCAG) — necessario perché il colore
 * dell'avversaria è scelto liberamente dal coach (anche chiaro, es. un
 * giallo) e il testo bianco sopra diventerebbe illeggibile. */
export function readableTextColor(hex: string): string {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.5 ? "#0d1926" : "#ffffff";
}

/** Colore di una squadra: A sempre il blu del club, B giallo in allenamento
 * o il colore scelto per l'avversaria in Partita. */
export function teamColor(key: TeamKey, mode: LiveScoreMode, opponentColor: string): string {
  return key === "A" ? HOME_COLOR : mode === "match" ? opponentColor : TRAINING_AWAY_COLOR;
}

// ── Disposizione in campo ──────────────────────────────────────────────

/**
 * Dove sta ogni posizione, vista da chi guarda la rete: `depth` 0 è la fila a
 * rete (più alta = più lontana), `lateral` va da sinistra a destra, `span` è
 * quante «corsie» laterali occupa (per centrare una giocatrice tra due).
 */
export interface CourtSlot {
  position: CourtPosition;
  depth: number;
  lateral: number;
  span: number;
}

export interface CourtLayout {
  /** Larghezza relativa di ogni fila, dalla rete al fondo. */
  depthWeights: number[];
  /** Quante corsie laterali ha la metà campo. */
  lanes: number;
  slots: CourtSlot[];
  /** Linea dei 3 metri tra la fila a rete e il fondo (solo con due file). */
  attackLine: boolean;
}

const slot = (position: CourtPosition, depth: number, lateral: number, span = 1): CourtSlot => ({
  position,
  depth,
  lateral,
  span,
});

/**
 * Le disposizioni dei vari formati. Numerazione come nella pallavolo a 6: la 1
 * è chi batte, e a ogni rotazione ognuna passa al numero prima (la 2 va in 1,
 * la 1 nell'ultimo) girando in senso orario.
 * - 6: rete 4-3-2, fondo 5-6-1.
 * - 5: rete 4-3-2, fondo 5-1.
 * - 4: a rombo — 3 a rete, 4 a sinistra, 2 a destra, 1 in fondo.
 * - 3: a triangolo — 2 a rete, 3 dietro a sinistra, 1 dietro a destra.
 * - 2: affiancate — 2 a sinistra, 1 a destra (battono a turno).
 */
const COURT_LAYOUTS: Record<LiveScorePlayers, CourtLayout> = {
  6: {
    depthWeights: [1, 2],
    lanes: 3,
    attackLine: true,
    slots: [slot(4, 0, 0), slot(3, 0, 1), slot(2, 0, 2), slot(5, 1, 0), slot(6, 1, 1), slot(1, 1, 2)],
  },
  5: {
    depthWeights: [1, 2],
    lanes: 6,
    attackLine: true,
    slots: [slot(4, 0, 0, 2), slot(3, 0, 2, 2), slot(2, 0, 4, 2), slot(5, 1, 0, 3), slot(1, 1, 3, 3)],
  },
  4: {
    depthWeights: [1, 1, 1],
    lanes: 2,
    attackLine: false,
    slots: [slot(3, 0, 0, 2), slot(4, 1, 0), slot(2, 1, 1), slot(1, 2, 0, 2)],
  },
  3: {
    depthWeights: [1, 2],
    lanes: 2,
    attackLine: true,
    slots: [slot(2, 0, 0, 2), slot(3, 1, 0), slot(1, 1, 1)],
  },
  2: {
    depthWeights: [1],
    lanes: 2,
    attackLine: false,
    slots: [slot(2, 0, 0), slot(1, 0, 1)],
  },
};

export function courtLayout(players: LiveScorePlayers): CourtLayout {
  return COURT_LAYOUTS[players];
}

/** Una cella della metà campo nel tabellone orizzontale (rete al centro). */
export interface HalfCourtCell {
  position: CourtPosition;
  /** Colonna e riga della griglia CSS (da 1). */
  column: number;
  row: number;
  rowSpan: number;
  /** Lato della cella su cui passa la linea dei 3 metri, se c'è. */
  attackLineSide: "left" | "right" | null;
}

/**
 * La metà campo pronta da disegnare. La squadra a sinistra guarda verso destra
 * (rete a destra, la sua sinistra in alto); quella a destra guarda verso
 * sinistra, e tutto si capovolge.
 */
export function halfCourtGrid(
  players: LiveScorePlayers,
  side: "left" | "right",
): { columns: string; rows: number; cells: HalfCourtCell[] } {
  const layout = courtLayout(players);
  const depths = layout.depthWeights.length;
  const weights = side === "left" ? [...layout.depthWeights].reverse() : layout.depthWeights;
  const cells = layout.slots.map((s) => {
    const column = side === "left" ? depths - s.depth : s.depth + 1;
    const row = side === "left" ? s.lateral + 1 : layout.lanes - s.lateral - s.span + 1;
    const isBackRow = layout.attackLine && s.depth === 1;
    return {
      position: s.position,
      column,
      row,
      rowSpan: s.span,
      attackLineSide: isBackRow ? (side === "left" ? "right" : "left") : null,
    } satisfies HalfCourtCell;
  });
  return { columns: weights.map((w) => `${w}fr`).join(" "), rows: layout.lanes, cells };
}

/** Le posizioni «a rete»: la libero, se c'è, esce quando chi sostituisce ci
 * arriva. A 4 (rombo) solo la 3, a 3 (triangolo) solo la 2. */
export function frontPositions(players: LiveScorePlayers): CourtPosition[] {
  return courtLayout(players)
    .slots.filter((s) => s.depth === 0)
    .map((s) => s.position);
}

/** Nel 2 contro 2 le giocatrici sono affiancate, senza seconda linea: la libero non c'è. */
export function hasLiberoOption(players: LiveScorePlayers): boolean {
  return players > 2;
}

/** Una rotazione: chi era in posizione 2 diventa la nuova battitrice
 * (posizione 1), chi era in posizione 1 va nell'ultima, e così via — il giro
 * in senso orario della pallavolo, con qualunque numero di giocatrici. */
export function rotateOnce(positions: string[]): string[] {
  if (positions.length === 0) return positions;
  return [...positions.slice(1), positions[0]];
}

/** Porta la formazione a `players` posizioni, tenendo i nomi già scritti
 * nelle posizioni che restano. */
export function resizePositions(positions: string[], players: LiveScorePlayers): string[] {
  return Array.from({ length: players }, (_, i) => positions[i] ?? "");
}

// ── Stato iniziale ─────────────────────────────────────────────────────

export function emptyTeam(label: string, players: LiveScorePlayers = 6): LiveScoreTeamState {
  return {
    label,
    positions: resizePositions([], players),
    liberoName: "",
    hostNames: ["", ""],
    liberoActiveFor: null,
    score: 0,
    setsWon: 0,
    timeoutsUsed: 0,
  };
}

/** Formato di gioco scelto in impostazione: resta uguale anche iniziando una
 * partita nuova. */
export interface LiveScoreFormat {
  mode: LiveScoreMode;
  playersPerSide: LiveScorePlayers;
  withLineup: boolean;
  useLibero: boolean;
}

export const DEFAULT_FORMAT: LiveScoreFormat = {
  mode: "training",
  playersPerSide: 6,
  withLineup: true,
  useLibero: false,
};

export function initialMatch(format: Partial<LiveScoreFormat> = {}, team: TrainingTeam = "u14u15"): LiveScoreState {
  const { mode, playersPerSide, withLineup, useLibero } = { ...DEFAULT_FORMAT, ...format };
  return {
    started: false,
    mode,
    servingTeam: null,
    sidesSwapped: false,
    teamA: emptyTeam(mode === "match" ? HOME_TEAM_LABEL : "Squadra A", playersPerSide),
    teamB: emptyTeam(mode === "match" ? "" : "Squadra B", playersPerSide),
    setHistory: [],
    opponentColor: DEFAULT_OPPONENT_COLOR,
    playersPerSide,
    withLineup,
    useLibero,
    publicLive: false,
    team,
    matchId: null,
    category: null,
  };
}

export function isTeamEmpty(team: LiveScoreTeamState): boolean {
  return (
    team.positions.every((n) => n.trim() === "") &&
    team.liberoName.trim() === "" &&
    team.score === 0 &&
    team.setsWon === 0
  );
}

// ── Punti e set ────────────────────────────────────────────────────────

function isHost(team: LiveScoreTeamState, name: string): boolean {
  const trimmed = name.trim();
  return trimmed !== "" && team.hostNames.some((h) => h.trim() === trimmed);
}

/** La libero conta solo se è in uso e ha un nome. */
export function liberoInPlay(match: LiveScoreState, team: LiveScoreTeamState): boolean {
  return match.withLineup && match.useLibero && hasLiberoOption(match.playersPerSide) && team.liberoName.trim() !== "";
}

/**
 * Assegna il punto alla squadra `winner`.
 *
 * Regolamento pallavolo: si ruota solo quando una squadra CONQUISTA la
 * battuta (vinceva la palla ricevendo), non quando la mantiene vincendo
 * mentre già serviva. La libero non è mai la prima a servire quando una delle
 * giocatrici che sostituisce arriva in battuta: serve lei stessa finché la sua
 * squadra continua a vincere, e solo quando PERDE il punto da battitrice
 * (side-out) la libero entra al suo posto — da quel momento la sostituisce per
 * tutta la sua permanenza in seconda linea, finché non ruota di nuovo a rete,
 * dove rientra di persona. Senza formazione si tiene solo il punteggio, senza
 * seguire chi batte.
 */
export function applyPoint(match: LiveScoreState, winner: TeamKey): LiveScoreState {
  const winnerKey = teamKeyProp(winner);
  const winnerTeam: LiveScoreTeamState = { ...match[winnerKey], score: match[winnerKey].score + 1 };

  if (match.servingTeam === winner) {
    // Stava già servendo e ha vinto: nessuna rotazione, nessun cambio libero.
    return { ...match, [winnerKey]: winnerTeam };
  }

  if (!match.withLineup) {
    // Solo punteggio: chi batte non si segue.
    return { ...match, servingTeam: null, [winnerKey]: winnerTeam };
  }

  const loserKeyName = otherKey(winner);
  const loserKey = teamKeyProp(loserKeyName);
  let loserTeam: LiveScoreTeamState = { ...match[loserKey] };

  if (match.servingTeam === loserKeyName && liberoInPlay(match, loserTeam)) {
    // Side-out: la squadra che stava servendo perde il punto. Se in
    // battuta (posizione 1) c'era una delle giocatrici sostituite dalla
    // libero, da ora la libero entra al suo posto.
    const server = (loserTeam.positions[0] ?? "").trim();
    if (isHost(loserTeam, server) && loserTeam.liberoActiveFor !== server) {
      loserTeam = { ...loserTeam, liberoActiveFor: server };
    }
  }

  // La squadra che vince conquista la battuta e ruota: se chi aveva la
  // libero al suo posto arriva a rete, rientra in campo di persona.
  const positions = rotateOnce(winnerTeam.positions);
  const replaced = winnerTeam.liberoActiveFor;
  const replacedAt = replaced ? positions.findIndex((n) => n.trim() === replaced) + 1 : 0;
  const backAtNet = replacedAt > 0 && frontPositions(match.playersPerSide).includes(replacedAt as CourtPosition);
  const rotatedWinner: LiveScoreTeamState = {
    ...winnerTeam,
    positions,
    liberoActiveFor: backAtNet ? null : replaced,
  };

  return {
    ...match,
    servingTeam: winner,
    [winnerKey]: rotatedWinner,
    [loserKey]: loserTeam,
  };
}

/** Chiude il set corrente: vince chi ha più punti (a pari punti non si
 * chiude). Il punteggio finale resta in `setHistory`, poi punteggio e
 * time-out si azzerano, la libero esce per entrambe e il coach sceglie di
 * nuovo chi serve per prima. */
export function closeSet(match: LiveScoreState): LiveScoreState {
  if (match.teamA.score === match.teamB.score) return match;
  const winner: TeamKey = match.teamA.score > match.teamB.score ? "A" : "B";
  const winnerKey = teamKeyProp(winner);
  const loserKey = teamKeyProp(otherKey(winner));
  return {
    ...match,
    servingTeam: null,
    setHistory: [...match.setHistory, { scoreA: match.teamA.score, scoreB: match.teamB.score }],
    [winnerKey]: {
      ...match[winnerKey],
      score: 0,
      setsWon: match[winnerKey].setsWon + 1,
      liberoActiveFor: null,
      timeoutsUsed: 0,
    },
    [loserKey]: { ...match[loserKey], score: 0, liberoActiveFor: null, timeoutsUsed: 0 },
  };
}

export function matchWinner(match: LiveScoreState): TeamKey | null {
  if (match.teamA.setsWon >= SETS_TO_WIN) return "A";
  if (match.teamB.setsWon >= SETS_TO_WIN) return "B";
  return null;
}

/** Cambia il numero di giocatrici: le formazioni si adattano, la libero resta
 * legata solo a chi è ancora in campo. */
export function withPlayersPerSide(match: LiveScoreState, players: LiveScorePlayers): LiveScoreState {
  const resizeTeam = (team: LiveScoreTeamState): LiveScoreTeamState => {
    const positions = resizePositions(team.positions, players);
    const names = new Set(positions.map((n) => n.trim()).filter(Boolean));
    const hostNames = team.hostNames.map((h) => (names.has(h.trim()) ? h : "")) as [string, string];
    return { ...team, positions, hostNames, liberoActiveFor: null };
  };
  return { ...match, playersPerSide: players, teamA: resizeTeam(match.teamA), teamB: resizeTeam(match.teamB) };
}

// ── Diretta pubblica ───────────────────────────────────────────────────

/**
 * Ciò che il sito pubblico vede del tabellone: solo se un admin ha attivato
 * la diretta, solo in Partita e solo a partita iniziata. Nomi delle atlete,
 * numeri di maglia, libero e formazioni non escono mai da qui.
 */
export function toPublicLiveScore(match: LiveScoreState, updatedAt: string): PublicLiveScore | null {
  if (!match.publicLive || match.mode !== "match" || !match.started) return null;
  const team = (key: TeamKey) => {
    const t = match[teamKeyProp(key)];
    return {
      name: key === "A" ? HOME_TEAM_LABEL : t.label.trim() || "Avversaria",
      color: teamColor(key, match.mode, match.opponentColor),
      score: t.score,
      sets: t.setsWon,
    };
  };
  return {
    team: match.team,
    category: match.category,
    home: team("A"),
    away: team("B"),
    serving: match.servingTeam === "A" ? "home" : match.servingTeam === "B" ? "away" : null,
    sets: match.setHistory.map((s) => ({ home: s.scoreA, away: s.scoreB })),
    finished: matchWinner(match) !== null,
    updatedAt,
  };
}

/** Categoria e avversaria da una partita del calendario, per collegarla al
 * tabellone (l'avversaria solo se non è un torneo, dove cambia a ogni gara). */
export function linkCalendarMatch(
  match: LiveScoreState,
  calendar: { id: string; category: Category | null; opponent: string; isTournament: boolean } | null,
): LiveScoreState {
  if (!calendar) return { ...match, matchId: null, category: null };
  return {
    ...match,
    matchId: calendar.id,
    category: calendar.category,
    teamB: calendar.isTournament ? match.teamB : { ...match.teamB, label: calendar.opponent },
  };
}
