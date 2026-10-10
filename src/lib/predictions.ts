import type { Match, MatchPrediction, SetScore, TournamentGame } from "@/lib/types";
import { format } from "date-fns";
import { todayIso } from "@/lib/today";

/** Dopo l'inizio della partita i pronostici restano aperti ancora per un'ora
 * (scelta organizzativa dello staff: chi arriva in palestra a partita già
 * cominciata fa in tempo a inserire il suo). */
export const PREDICTION_GRACE_MINUTES = 60;

const MINUTE_MS = 60_000;

/** Vero se i pronostici di una partita sono chiusi per il solo orario: è
 * passata un'ora dall'inizio. L'orario della partita è ora italiana senza
 * fuso: sul server vale perché il server lavora in ora italiana
 * (src/instrumentation.ts). `now` è iniettabile per i test. */
export function isMatchLocked(matchDate: string, now: number = Date.now()): boolean {
  return new Date(matchDate).getTime() + PREDICTION_GRACE_MINUTES * MINUTE_MS <= now;
}

/** Vero se i pronostici sono chiusi: un'ora dopo l'inizio, oppure subito se il
 * risultato è già stato inserito (finita la partita, indovinare non ha più
 * senso: chi arriva dopo conoscerebbe già l'esito). */
export function arePredictionsClosed(match: Match, now: number = Date.now()): boolean {
  return isMatchLocked(match.matchDate, now) || matchHasResult(match);
}

/** Vero dal primo minuto del giorno della partita: tutte le partite restano
 * visibili nell'elenco "Da pronosticare" fin dall'inizio della stagione, ma
 * si può pronosticare solo a partire dal giorno in cui si gioca. Confronto
 * solo sulla data, come in partite/actions.ts per il risultato reale. */
export function hasPredictionOpened(matchDate: string, today: string = todayIso()): boolean {
  return matchDate.slice(0, 10) <= today;
}

/** Vero se in questo momento si può inviare o modificare un pronostico: dal
 * giorno della partita fino a un'ora dopo il suo inizio, e non oltre il
 * risultato. */
export function canPredict(match: Match, now: number = Date.now()): boolean {
  return hasPredictionOpened(match.matchDate, todayIso(new Date(now))) && !arePredictionsClosed(match, now);
}

/** Ora di chiusura, per mostrarla: «19:00», o «00:30» con `nextDay` se la
 * partita è così tarda che la chiusura cade dopo mezzanotte. */
export function predictionClosingTime(matchDate: string): { time: string; nextDay: boolean } {
  const closes = new Date(new Date(matchDate).getTime() + PREDICTION_GRACE_MINUTES * MINUTE_MS);
  return { time: format(closes, "HH:mm"), nextDay: format(closes, "yyyy-MM-dd") !== matchDate.slice(0, 10) };
}

/** «alle 19:00» (o «alle 00:30 (dopo mezzanotte)») per le frasi in pagina. */
export function predictionClosingLabel(matchDate: string): string {
  const { time, nextDay } = predictionClosingTime(matchDate);
  return nextDay ? `alle ${time} (dopo mezzanotte)` : `alle ${time}`;
}

/**
 * Motore di punteggio dei Pronostici: per ogni set REALMENTE giocato,
 * stabilisce chi tra i pronostici presentati si è "avvicinato di più" al
 * risultato vero, secondo sei parametri, applicati in ordine di priorità
 * (non una somma pesata unica — evita che un pronostico assurdo vinca solo
 * perché la differenza numerica è piccola):
 *
 *   1. Punteggio esatto (entrambi i numeri esatti) — vince sempre, a
 *      prescindere dal resto.
 *   2. Vincitore del set indovinato — tra chi non ha il punteggio esatto,
 *      chi ha previsto la squadra giusta a vincere quel set batte sempre
 *      chi ha sbagliato vincitore, anche se quest'ultimo è numericamente
 *      "più vicino".
 *   3. Errore punti Lignano — |previsto.us − reale.us|
 *   4. Errore punti avversaria — |previsto.them − reale.them|
 *   5. Errore margine — |(previsto.us − previsto.them) − (reale.us − reale.them)|
 *   6. Errore punti totali del set — |(previsto.us + previsto.them) − (reale.us + reale.them)|
 *
 * I parametri 3-6 si sommano in un'unica distanza usata come criterio di
 * ordinamento fine, solo tra pronostici già alla pari sui parametri 1-2.
 * Pronostici a pari merito su tutti e sei vincono insieme quel set (nessuna
 * divisione di punti). Un pronostico che copre un set mai giocato non entra
 * nel confronto per quell'indice — nessuna penalità.
 */

interface PredictionEntry {
  staffId: string;
  predicted: SetScore;
}

export interface SetRankingEntry {
  staffId: string;
  predicted: SetScore;
  exactMatch: boolean;
  correctWinner: boolean;
  distance: number;
  isWinner: boolean;
}

function setWinner(score: SetScore): "us" | "them" {
  return score.us > score.them ? "us" : "them";
}

function distance(predicted: SetScore, actual: SetScore): number {
  const errUs = Math.abs(predicted.us - actual.us);
  const errThem = Math.abs(predicted.them - actual.them);
  const errMargin = Math.abs(predicted.us - predicted.them - (actual.us - actual.them));
  const errTotal = Math.abs(predicted.us + predicted.them - (actual.us + actual.them));
  return errUs + errThem + errMargin + errTotal;
}

/** Classifica i pronostici di UN set secondo i sei parametri sopra;
 * `isWinner` è true per tutti quelli a pari merito in cima. Lista vuota se
 * nessuno aveva pronosticato quell'indice di set. */
export function rankSetPredictions(actual: SetScore, entries: PredictionEntry[]): SetRankingEntry[] {
  if (entries.length === 0) return [];

  const actualWinner = setWinner(actual);
  const scored = entries.map((entry) => ({
    staffId: entry.staffId,
    predicted: entry.predicted,
    exactMatch: entry.predicted.us === actual.us && entry.predicted.them === actual.them,
    correctWinner: setWinner(entry.predicted) === actualWinner,
    distance: distance(entry.predicted, actual),
  }));

  function rank(entry: (typeof scored)[number]): [number, number, number] {
    return [entry.exactMatch ? 0 : 1, entry.correctWinner ? 0 : 1, entry.distance];
  }

  const best = scored.reduce((a, b) => {
    const [a1, a2, a3] = rank(a);
    const [b1, b2, b3] = rank(b);
    if (a1 !== b1) return a1 < b1 ? a : b;
    if (a2 !== b2) return a2 < b2 ? a : b;
    return a3 <= b3 ? a : b;
  });
  const bestRank = rank(best);

  return scored.map((entry) => {
    const r = rank(entry);
    const isWinner = r[0] === bestRank[0] && r[1] === bestRank[1] && r[2] === bestRank[2];
    return { ...entry, isWinner };
  });
}

export interface MatchSetResult {
  setIndex: number; // 0-based
  actual: SetScore;
  rankings: SetRankingEntry[];
}

/** Applica rankSetPredictions a ogni set REALMENTE giocato di una partita
 * non-torneo (match.setScores), ignorando eventuali set pronosticati oltre
 * la lunghezza reale della partita. null se la partita non ha ancora un
 * risultato (o è un torneo: vedi computeTournamentMatchResults). */
export function computeMatchResults(match: Match, predictions: MatchPrediction[]): MatchSetResult[] | null {
  if (!match.setScores || match.setScores.length === 0) return null;

  return match.setScores.map((actual, setIndex) => {
    const entries: PredictionEntry[] = predictions
      .filter((p) => p.setScores?.[setIndex] !== undefined)
      .map((p) => ({ staffId: p.staffId, predicted: p.setScores![setIndex] }));
    return { setIndex, actual, rankings: rankSetPredictions(actual, entries) };
  });
}

function normalizeOpponent(name: string): string {
  return name.trim().toLowerCase();
}

export interface TournamentGameSetResults {
  gameId: string;
  opponent: string;
  sets: MatchSetResult[];
}

/** Come computeMatchResults, ma per un torneo: una partita per ogni
 * avversaria REALMENTE affrontata (match.tournamentGames). Un pronostico si
 * abbina a una partita reale per nome avversaria (confronto normalizzato:
 * spazi e maiuscole/minuscole ignorati, non un vero fuzzy-match) — un
 * pronostico contro un'avversaria mai affrontata non entra nel confronto,
 * nessuna penalità. null se il torneo non ha ancora nessun risultato. */
export function computeTournamentMatchResults(
  match: Match,
  predictions: MatchPrediction[],
): TournamentGameSetResults[] | null {
  if (!match.tournamentGames || match.tournamentGames.length === 0) return null;
  const played = match.tournamentGames.filter((g) => g.setScores.length > 0);
  if (played.length === 0) return null;

  return played.map((game) => {
    const predictedGamesByStaff = predictions
      .map((p) => ({
        staffId: p.staffId,
        game: p.tournamentGames?.find((g: TournamentGame) => normalizeOpponent(g.opponent) === normalizeOpponent(game.opponent)),
      }))
      .filter((entry): entry is { staffId: string; game: TournamentGame } => Boolean(entry.game));

    const sets: MatchSetResult[] = game.setScores.map((actual, setIndex) => {
      const entries: PredictionEntry[] = predictedGamesByStaff
        .filter(({ game: predictedGame }) => predictedGame.setScores[setIndex] !== undefined)
        .map(({ staffId, game: predictedGame }) => ({ staffId, predicted: predictedGame.setScores[setIndex] }));
      return { setIndex, actual, rankings: rankSetPredictions(actual, entries) };
    });

    return { gameId: game.id, opponent: game.opponent, sets };
  });
}

/** true se una partita ha già un risultato inserito — normale o torneo. */
export function matchHasResult(match: Match): boolean {
  if (match.isTournament) {
    return Boolean(match.tournamentGames?.some((g) => g.setScores.length > 0));
  }
  return Boolean(match.setScores && match.setScores.length > 0);
}

export interface LeaderboardEntry {
  staffId: string;
  points: number;
  setsPredicted: number;
}

/** Somma i punti (1 per ogni set vinto, vedi rankSetPredictions) per
 * staffId su tutte le partite con risultato passate — nessun concetto di
 * "stagione" con inizio/fine, come per il bilancio stagione esistente. */
export function computeLeaderboard(
  matches: Match[],
  predictionsByMatch: Map<string, MatchPrediction[]>,
): LeaderboardEntry[] {
  const points = new Map<string, number>();
  const setsPredicted = new Map<string, number>();

  for (const match of matches) {
    const predictions = predictionsByMatch.get(match.id) ?? [];
    const setResults = match.isTournament
      ? (computeTournamentMatchResults(match, predictions) ?? []).flatMap((g) => g.sets)
      : computeMatchResults(match, predictions);
    if (!setResults) continue;
    for (const result of setResults) {
      for (const entry of result.rankings) {
        setsPredicted.set(entry.staffId, (setsPredicted.get(entry.staffId) ?? 0) + 1);
        if (entry.isWinner) {
          points.set(entry.staffId, (points.get(entry.staffId) ?? 0) + 1);
        }
      }
    }
  }

  const staffIds = new Set([...points.keys(), ...setsPredicted.keys()]);
  return Array.from(staffIds)
    .map((staffId) => ({
      staffId,
      points: points.get(staffId) ?? 0,
      setsPredicted: setsPredicted.get(staffId) ?? 0,
    }))
    .sort((a, b) => b.points - a.points || b.setsPredicted - a.setsPredicted);
}
