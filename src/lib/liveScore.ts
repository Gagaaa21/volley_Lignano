import type {
  Category,
  CourtPosition,
  LiveScoreMode,
  LiveScorePlayers,
  LiveScoreRules,
  LiveScoreState,
  LiveScoreTeamState,
  PublicLiveScore,
  TrainingTeam,
} from "@/lib/types";
import { resizePositions } from "@/lib/courtLayout";
import {
  afterRally,
  liberoUsable,
  reentryFor,
  refreshLibero,
  substituteLineup,
  substitutionProblemFor,
  substitutionRuleWarning,
} from "@/lib/lineup";
import {
  DEFAULT_LAST_SET_POINTS,
  DEFAULT_SET_POINTS,
  isDecidingSet,
  isMatchDecided,
  isSetWon,
  setPointHolder,
  setsToWin,
  sideChangeDue,
  SUBSTITUTIONS_PER_SET,
  targetForSet,
  TIMEOUTS_PER_SET,
} from "@/lib/volleyRules";

/**
 * Regole del tabellone live (src/app/admin/livescore), separate dalla pagina
 * per poterle provare da sole: punti, rotazione, libero, set e partita, e ciò
 * che il sito pubblico può vedere della diretta. Valgono per ogni formato, dal
 * 2 contro 2 al 6 contro 6. Le regole di campo (rotazione, libero) stanno in
 * lineup.ts, quelle dei set in volleyRules.ts: sono le stesse dello Scout.
 */

// La disposizione in campo e la rotazione stanno in courtLayout.ts (le usa anche lo Scout).
export * from "@/lib/courtLayout";

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
/** Time-out a disposizione di ciascuna squadra per set (vedi le regole della stagione in volleyRules.ts). */
export const MAX_TIMEOUTS_PER_SET = TIMEOUTS_PER_SET;
/** Senza formula (allenamento libero) la partita si chiude a 3 set vinti, come sempre. */
const FREE_SETS_TO_WIN = 3;

/** Sostituzioni consentite per set: 8 nel 6 contro 6 (dal 2026/2027, prima erano 6); negli altri formati
 * (giovanili, minivolley) le regole cambiano, quindi solo il conteggio. */
export function substitutionLimit(players: LiveScorePlayers): number | null {
  return players === 6 ? SUBSTITUTIONS_PER_SET : null;
}

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

// ── Stato iniziale ─────────────────────────────────────────────────────

export function emptyTeam(label: string, players: LiveScorePlayers = 6): LiveScoreTeamState {
  return {
    label,
    positions: resizePositions([], players),
    liberoName: "",
    hostNames: ["", ""],
    liberoActiveFor: null,
    startPositions: [],
    score: 0,
    setsWon: 0,
    timeoutsUsed: 0,
    substitutionsUsed: 0,
  };
}

/** Formula di partenza: una partita è al meglio dei 5 set, un allenamento non ha limiti. */
export function defaultRules(mode: LiveScoreMode): LiveScoreRules {
  return {
    format: mode === "match" ? "bo5" : "free",
    setPoints: DEFAULT_SET_POINTS,
    lastSetPoints: DEFAULT_LAST_SET_POINTS,
  };
}

/** Formato di gioco scelto in impostazione: resta uguale anche iniziando una
 * partita nuova. */
export interface LiveScoreFormat {
  mode: LiveScoreMode;
  playersPerSide: LiveScorePlayers;
  withLineup: boolean;
  useLibero: boolean;
  /** Formula e punti per set; se manca valgono quelli del tipo (partita o allenamento). */
  rules?: LiveScoreRules;
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
    substitutions: [],
    rules: format.rules ?? defaultRules(mode),
    setFirstServer: null,
    sideChangeDone: false,
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

/** Passa da Allenamento a Partita (o viceversa) in impostazione: le etichette
 * cambiano, la diretta e il collegamento al calendario esistono solo in
 * Partita, e la formula segue il tipo (al meglio dei 5 in Partita, libera in
 * allenamento) se non è già stata cambiata a mano. */
export function withMode(match: LiveScoreState, mode: LiveScoreMode): LiveScoreState {
  if (match.started) return match;
  const isMatch = mode === "match";
  const format =
    isMatch && match.rules.format === "free"
      ? "bo5"
      : !isMatch && match.rules.format === "bo5"
        ? "free"
        : match.rules.format;
  return {
    ...match,
    mode,
    teamA: { ...match.teamA, label: isMatch ? HOME_TEAM_LABEL : "Squadra A" },
    teamB: { ...match.teamB, label: isMatch ? "" : "Squadra B" },
    publicLive: isMatch && match.publicLive,
    matchId: isMatch ? match.matchId : null,
    category: isMatch ? match.category : null,
    rules: { ...match.rules, format },
  };
}

// ── Libero e formazioni ────────────────────────────────────────────────

/** La libero conta solo se è in uso e ha un nome. */
export function liberoInPlay(match: LiveScoreState, team: LiveScoreTeamState): boolean {
  return match.withLineup && liberoUsable(team, match.playersPerSide, match.useLibero);
}

/** Riallinea la libero di entrambe alle posizioni attuali (dopo aver cambiato una posizione, la libero o le sostituite). */
export function reconcileLibero(match: LiveScoreState): LiveScoreState {
  if (!match.started || !match.withLineup) return match;
  const useLibero = match.useLibero;
  const players = match.playersPerSide;
  return {
    ...match,
    teamA: refreshLibero(match.teamA, players, useLibero, match.servingTeam === "A"),
    teamB: refreshLibero(match.teamB, players, useLibero, match.servingTeam === "B"),
  };
}

// ── Partenza e punti ───────────────────────────────────────────────────

/**
 * Comincia la partita: chi batte per prima (solo con la formazione), la
 * formazione di partenza del 1° set e la libero già dove deve stare (la
 * centrale in seconda linea, che non batte, ha subito la libero al suo posto).
 */
export function startMatch(match: LiveScoreState, servingTeam: TeamKey | null): LiveScoreState {
  const serving = match.withLineup ? servingTeam : null;
  const prepare = (team: LiveScoreTeamState, key: TeamKey): LiveScoreTeamState =>
    refreshLibero(
      { ...team, startPositions: match.withLineup ? [...team.positions] : [] },
      match.playersPerSide,
      match.withLineup && match.useLibero,
      serving === key,
    );
  return {
    ...match,
    started: true,
    servingTeam: serving,
    setFirstServer: serving,
    sideChangeDone: false,
    teamA: prepare(match.teamA, "A"),
    teamB: prepare(match.teamB, "B"),
  };
}

/**
 * Assegna il punto alla squadra `winner`.
 *
 * Regolamento pallavolo: si ruota solo quando una squadra CONQUISTA la
 * battuta (vinceva la palla ricevendo), non quando la mantiene vincendo
 * mentre già serviva. La libero non batte mai: se in battuta c'è una delle
 * giocatrici che sostituisce, batte lei stessa e la libero entra al suo posto
 * solo quando la sua squadra torna a ricevere; esce quando chi sostituisce
 * ruota a rete (vedi lineup.ts). Senza formazione si tiene solo il punteggio,
 * senza seguire chi batte.
 */
export function applyPoint(match: LiveScoreState, winner: TeamKey): LiveScoreState {
  const winnerProp = teamKeyProp(winner);
  const loserProp = teamKeyProp(otherKey(winner));
  // La formazione con cui comincia il set si ricorda al primo punto: a fine set si torna lì.
  const fresh = match.teamA.score + match.teamB.score === 0;
  // Se a 0-0 si è già fatto un cambio, la formazione di partenza è quella registrata prima: chi è entrata non diventa titolare.
  const remember = (team: LiveScoreTeamState, key: TeamKey): LiveScoreTeamState =>
    fresh && match.withLineup && setSubstitutions(match, key).length === 0 ? { ...team, startPositions: [...team.positions] } : team;
  const winnerTeam: LiveScoreTeamState = { ...remember(match[winnerProp], winner), score: match[winnerProp].score + 1 };
  const loserTeam = remember(match[loserProp], otherKey(winner));

  if (!match.withLineup) {
    // Solo punteggio: chi batte non si segue.
    return { ...match, servingTeam: null, [winnerProp]: winnerTeam };
  }

  const result = afterRally({
    players: match.playersPerSide,
    useLibero: match.useLibero,
    winner: winnerTeam,
    loser: loserTeam,
    // Se non si sa chi batteva (non dovrebbe succedere: va scelto prima) non si ruota.
    winnerWasServing: match.servingTeam === winner || match.servingTeam === null,
  });
  return { ...match, servingTeam: winner, [winnerProp]: result.winner, [loserProp]: result.loser };
}

// ── Set e partita ──────────────────────────────────────────────────────

/** Set in corso (1 = primo). */
export function currentSet(match: LiveScoreState): number {
  return match.setHistory.length + 1;
}

/** A quanti punti finisce il set in corso; null con la formula libera (si chiude a mano). */
export function currentSetTarget(match: LiveScoreState): number | null {
  const { format } = match.rules;
  if (format === "free") return null;
  return targetForSet({ ...match.rules, format }, currentSet(match));
}

/** Chi ha vinto la partita: con la formula libera, chi arriva a 3 set. */
export function matchWinner(match: LiveScoreState): TeamKey | null {
  const a = match.teamA.setsWon;
  const b = match.teamB.setsWon;
  const { format } = match.rules;
  if (format === "free") {
    if (a >= FREE_SETS_TO_WIN) return "A";
    if (b >= FREE_SETS_TO_WIN) return "B";
    return null;
  }
  if (!isMatchDecided(format, a, b, match.setHistory.length) || a === b) return null;
  return a > b ? "A" : "B";
}

/** Il set in corso è vinto per regolamento (limite raggiunto con due punti di scarto): si può chiuderlo. */
export function suggestedSetEnd(match: LiveScoreState): TeamKey | null {
  const target = currentSetTarget(match);
  if (target === null || !match.started || matchWinner(match)) return null;
  const { score: a } = match.teamA;
  const { score: b } = match.teamB;
  return isSetWon(a, b, target) ? (a > b ? "A" : "B") : null;
}

/** Chi, vincendo il prossimo punto, vincerebbe il set (null se nessuno). */
export function setPointFor(match: LiveScoreState): TeamKey | null {
  const target = currentSetTarget(match);
  if (target === null || matchWinner(match)) return null;
  const holder = setPointHolder(match.teamA.score, match.teamB.score, target);
  return holder === "a" ? "A" : holder === "b" ? "B" : null;
}

/** Come setPointFor, ma quel set deciderebbe anche la partita. */
export function matchPointFor(match: LiveScoreState): TeamKey | null {
  const holder = setPointFor(match);
  if (!holder) return null;
  const { format } = match.rules;
  const needed = format === "free" ? FREE_SETS_TO_WIN : setsToWin(format);
  // Con 3 set obbligatori la partita si decide solo all'ultimo.
  if (needed === null) return currentSet(match) >= 3 ? holder : null;
  return match[teamKeyProp(holder)].setsWon + 1 >= needed ? holder : null;
}

/** Nel set decisivo, a 8 punti, le squadre cambiano campo. */
export function sideChangeNeeded(match: LiveScoreState): boolean {
  const { format } = match.rules;
  if (format === "free" || !match.started || matchWinner(match)) return false;
  return sideChangeDue(format, currentSet(match), match.teamA.score, match.teamB.score, match.sideChangeDone);
}

/** Cambio campo: le squadre si scambiano di lato (solo resa visiva, la rotazione non cambia). */
export function changeSides(match: LiveScoreState): LiveScoreState {
  return { ...match, sidesSwapped: !match.sidesSwapped, sideChangeDone: match.sideChangeDone || sideChangeNeeded(match) };
}

/** Il set in corso è ancora a 0-0 (si può ancora cambiare chi batte). */
export function isSetFresh(match: LiveScoreState): boolean {
  return match.teamA.score === 0 && match.teamB.score === 0;
}

/** Chi batte per primo nel set successivo: si alterna a ogni set, e nel set decisivo si sorteggia (null = da scegliere). */
export function nextSetFirstServer(match: LiveScoreState): TeamKey | null {
  if (!match.withLineup || !match.setFirstServer) return null;
  const { format } = match.rules;
  if (format !== "free" && isDecidingSet(format, currentSet(match) + 1)) return null;
  return otherKey(match.setFirstServer);
}

/** Tocca a chi sceglie chi batte per primo: partita cominciata, con la formazione, e nessuno ha ancora battuto. */
export function needsFirstServer(match: LiveScoreState): boolean {
  return match.started && match.withLineup && match.servingTeam === null && matchWinner(match) === null;
}

/** Sceglie (o corregge) chi batte per primo, finché il set è a 0-0. */
export function chooseFirstServer(match: LiveScoreState, key: TeamKey): LiveScoreState {
  if (!match.started || !match.withLineup || !isSetFresh(match)) return match;
  return reconcileLibero({ ...match, servingTeam: key, setFirstServer: key });
}

/**
 * Chiude il set corrente: vince chi ha più punti (a pari punti non si
 * chiude). Il punteggio finale resta in `setHistory`, poi punteggio e
 * time-out si azzerano. Se la partita non è finita comincia il set dopo:
 * le squadre cambiano campo, ognuna torna alla formazione di partenza, la
 * battuta passa all'altra squadra (nel set decisivo si sorteggia: la sceglie il
 * coach) e la libero si riallinea.
 */
export function closeSet(match: LiveScoreState): LiveScoreState {
  if (match.teamA.score === match.teamB.score) return match;
  const winner: TeamKey = match.teamA.score > match.teamB.score ? "A" : "B";
  const winnerProp = teamKeyProp(winner);
  const loserProp = teamKeyProp(otherKey(winner));
  const reset = (team: LiveScoreTeamState, won: boolean): LiveScoreTeamState => ({
    ...team,
    score: 0,
    setsWon: team.setsWon + (won ? 1 : 0),
    liberoActiveFor: null,
    timeoutsUsed: 0,
    substitutionsUsed: 0,
  });
  const closed: LiveScoreState = {
    ...match,
    servingTeam: null,
    setHistory: [...match.setHistory, { scoreA: match.teamA.score, scoreB: match.teamB.score }],
    [winnerProp]: reset(match[winnerProp], true),
    [loserProp]: reset(match[loserProp], false),
  };
  // Partita finita: tutto resta com'è, nessun set da preparare.
  if (matchWinner(closed)) return closed;

  const first = nextSetFirstServer(match);
  const restore = (team: LiveScoreTeamState, key: TeamKey): LiveScoreTeamState => {
    const positions = team.startPositions.length === match.playersPerSide ? [...team.startPositions] : team.positions;
    return refreshLibero({ ...team, positions }, match.playersPerSide, match.withLineup && match.useLibero, first === key);
  };
  return {
    ...closed,
    sidesSwapped: !match.sidesSwapped,
    sideChangeDone: false,
    servingTeam: first,
    setFirstServer: first,
    teamA: restore(closed.teamA, "A"),
    teamB: restore(closed.teamB, "B"),
  };
}

// ── Sostituzioni ───────────────────────────────────────────────────────

/** Perché una sostituzione non si può fare, o null se va bene. */
export function substitutionProblem(
  match: LiveScoreState,
  key: TeamKey,
  position: CourtPosition,
  incoming: string,
): string | null {
  const team = match[teamKeyProp(key)];
  return substitutionProblemFor(team, position, incoming, liberoInPlay(match, team));
}

/** I cambi di una squadra nel set in corso. */
function setSubstitutions(match: LiveScoreState, key: TeamKey) {
  const set = currentSet(match);
  return match.substitutions.filter((s) => s.team === key && s.set === set);
}

/**
 * Chi era in campo all'inizio del set (per le regole dei cambi). A 0-0 la formazione si può ancora correggere,
 * quindi vale quella di adesso, a meno che si sia già fatto un cambio: allora chi è uscita era titolare e la
 * formazione di partenza è quella registrata.
 */
function startersOf(match: LiveScoreState, key: TeamKey): string[] {
  const team = match[teamKeyProp(key)];
  const recorded = team.startPositions.length === team.positions.length;
  const lineupFixed = !isSetFresh(match) || setSubstitutions(match, key).length > 0;
  return recorded && lineupFixed ? team.startPositions : team.positions;
}

/**
 * Avvertimento (non un divieto) quando un cambio non rispetta le regole delle
 * sostituzioni nel 6 contro 6 (vedi substitutionRuleWarning in lineup.ts).
 * Null se va tutto bene.
 */
export function substitutionWarning(
  match: LiveScoreState,
  key: TeamKey,
  position: CourtPosition,
  incoming: string,
): string | null {
  if (!match.withLineup || match.playersPerSide !== 6) return null;
  const team = match[teamKeyProp(key)];
  return substitutionRuleWarning({
    incoming,
    outgoing: team.positions[position - 1] ?? "",
    subs: setSubstitutions(match, key),
    starters: startersOf(match, key),
    limit: substitutionLimit(match.playersPerSide),
  });
}

/**
 * Se `player` è una titolare uscita in questo set che può ancora rientrare: chi l'ha sostituita e dove si trova
 * adesso (la posizione di campo da scegliere come «Esce»). Rientra al posto della sostituta, non nella posizione
 * in cui è uscita: nel frattempo la squadra può aver ruotato. Null se non può rientrare o la sostituta non è più in campo.
 */
export function reentryOf(
  match: LiveScoreState,
  key: TeamKey,
  player: string,
): { replacedBy: string; position: CourtPosition } | null {
  if (!match.withLineup || match.playersPerSide !== 6) return null;
  const found = reentryFor({ player, subs: setSubstitutions(match, key), starters: startersOf(match, key) });
  if (!found) return null;
  const index = match[teamKeyProp(key)].positions.findIndex((n) => n.trim() === found.replacedBy);
  return index < 0 ? null : { replacedBy: found.replacedBy, position: (index + 1) as CourtPosition };
}

/**
 * Sostituzione durante il gioco: chi entra prende la posizione di chi esce.
 * Se chi esce era una delle giocatrici che la libero sostituisce, il ruolo
 * passa a chi entra. Conta come cambio del set solo se in quella posizione
 * c'era davvero qualcuna.
 */
export function substitutePlayer(
  match: LiveScoreState,
  key: TeamKey,
  position: CourtPosition,
  incoming: string,
): LiveScoreState {
  if (substitutionProblem(match, key, position, incoming)) return match;
  const prop = teamKeyProp(key);
  const team = match[prop];
  const { lineup, outgoing, counts } = substituteLineup(team, position, incoming, {
    players: match.playersPerSide,
    useLibero: match.withLineup && match.useLibero,
    isServing: match.servingTeam === key,
  });
  return {
    ...match,
    [prop]: { ...lineup, substitutionsUsed: team.substitutionsUsed + (counts ? 1 : 0) },
    substitutions: counts
      ? [...match.substitutions, { team: key, set: currentSet(match), position, out: outgoing, in: incoming.trim() }]
      : match.substitutions,
  };
}

/** Cambia il numero di giocatrici: le formazioni si adattano, la libero resta
 * legata solo a chi è ancora in campo. */
export function withPlayersPerSide(match: LiveScoreState, players: LiveScorePlayers): LiveScoreState {
  const resizeTeam = (team: LiveScoreTeamState): LiveScoreTeamState => {
    const positions = resizePositions(team.positions, players);
    const names = new Set(positions.map((n) => n.trim()).filter(Boolean));
    const hostNames = team.hostNames.map((h) => (names.has(h.trim()) ? h : "")) as [string, string];
    return { ...team, positions, hostNames, liberoActiveFor: null, startPositions: [] };
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
