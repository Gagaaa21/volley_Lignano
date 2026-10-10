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

/** Quante giocatrici stanno a rete e quante in seconda linea: a 6 tre e tre,
 * a 5 tre e due, a 4 due e due, a 3 due a rete e una dietro, a 2 una e una. */
export function rowSizes(players: LiveScorePlayers): { front: number; back: number } {
  const front = Math.ceil(players / 2);
  return { front, back: players - front };
}

/**
 * Le posizioni di ogni fila, da sinistra a destra per chi guarda la rete.
 * Numerazione come nella pallavolo a 6, estesa agli altri formati: la 1 è in
 * fondo a destra (chi batte), poi si sale a rete da destra verso sinistra e si
 * torna indietro da sinistra verso destra. A 6: rete 4-3-2, fondo 5-6-1.
 */
export function courtRows(players: LiveScorePlayers): { front: CourtPosition[]; back: CourtPosition[] } {
  const { front } = rowSizes(players);
  const frontRow: CourtPosition[] = [];
  for (let p = front + 1; p >= 2; p--) frontRow.push(p as CourtPosition);
  const backRow: CourtPosition[] = [];
  for (let p = front + 2; p <= players; p++) backRow.push(p as CourtPosition);
  backRow.push(1);
  return { front: frontRow, back: backRow };
}

/**
 * Le due colonne di una metà campo, dall'alto in basso, per il campo
 * orizzontale del tabellone (rete al centro). La squadra a sinistra guarda
 * verso destra, quindi la sua sinistra è in alto; quella a destra guarda
 * verso sinistra, e l'ordine si capovolge.
 */
export function halfCourtColumns(
  players: LiveScorePlayers,
  side: "left" | "right",
): { net: CourtPosition[]; baseline: CourtPosition[] } {
  const { front, back } = courtRows(players);
  return side === "left"
    ? { net: front, baseline: back }
    : { net: [...front].reverse(), baseline: [...back].reverse() };
}

/** Le posizioni in uso, 1…N. */
export function positionsFor(players: LiveScorePlayers): CourtPosition[] {
  return Array.from({ length: players }, (_, i) => (i + 1) as CourtPosition);
}

/** Una rotazione: chi era in posizione 2 diventa la nuova battitrice
 * (posizione 1), chi era in posizione 1 va nell'ultima, e così via — il giro
 * in senso orario della pallavolo, con qualunque numero di giocatrici. */
export function rotateOnce(positions: string[]): string[] {
  if (positions.length === 0) return positions;
  return [...positions.slice(1), positions[0]];
}

/** Indice (in positions) di chi, alla prossima rotazione, lascia la seconda
 * linea per andare a rete: a 6 è la posizione 5 (che passa in 4). */
export function exitingBackRowIndex(players: LiveScorePlayers): number {
  const { front } = rowSizes(players);
  return front + 2 <= players ? front + 1 : 0;
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
  return match.withLineup && match.useLibero && team.liberoName.trim() !== "";
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
 * dove rientra di persona. Senza formazione si tiene solo il punteggio e chi
 * serve.
 */
export function applyPoint(match: LiveScoreState, winner: TeamKey): LiveScoreState {
  const winnerKey = teamKeyProp(winner);
  const winnerTeam: LiveScoreTeamState = { ...match[winnerKey], score: match[winnerKey].score + 1 };

  if (match.servingTeam === winner) {
    // Stava già servendo e ha vinto: nessuna rotazione, nessun cambio libero.
    return { ...match, [winnerKey]: winnerTeam };
  }

  if (!match.withLineup) {
    return { ...match, servingTeam: winner, [winnerKey]: winnerTeam };
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

  // La squadra che vince conquista la battuta e ruota: chi lascia la
  // seconda linea per andare a rete rientra in campo di persona se era lei
  // ad avere la libero dentro.
  const exiting = (winnerTeam.positions[exitingBackRowIndex(match.playersPerSide)] ?? "").trim();
  const rotatedWinner: LiveScoreTeamState = {
    ...winnerTeam,
    positions: rotateOnce(winnerTeam.positions),
    liberoActiveFor: winnerTeam.liberoActiveFor === exiting ? null : winnerTeam.liberoActiveFor,
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
