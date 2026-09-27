import "server-only";
import type { SetScore, TournamentGame } from "@/lib/types";

export interface ParsedSetScores {
  setScores: SetScore[] | null;
  resultSetsWon: number | null;
  resultSetsLost: number | null;
  error?: string;
}

/**
 * Deriva set vinti/persi da una sequenza di coppie punteggio (es. "25-20"),
 * set per set — la regola di validità condivisa da ogni punto
 * dell'applicazione che chiede un risultato di pallavolo: una squadra deve
 * arrivare esattamente a 3 set vinti, nessun set in parità. Coppie
 * completamente in bianco vengono ignorate (set non giocato/non
 * pronosticato), non contano come errore finché almeno un set completo è
 * stato inserito.
 */
export function validateSetScorePairs(pairs: { us: string; them: string }[]): ParsedSetScores {
  const setScores: SetScore[] = [];
  for (let i = 0; i < pairs.length; i++) {
    const usRaw = pairs[i].us.trim();
    const themRaw = pairs[i].them.trim();
    if (!usRaw && !themRaw) continue;
    if (!usRaw || !themRaw) {
      return {
        setScores: null,
        resultSetsWon: null,
        resultSetsLost: null,
        error: `Inserisci il punteggio di entrambe le squadre per il set ${i + 1}.`,
      };
    }
    const us = Number(usRaw);
    const them = Number(themRaw);
    if (!Number.isInteger(us) || !Number.isInteger(them) || us < 0 || them < 0 || us > 99 || them > 99) {
      return {
        setScores: null,
        resultSetsWon: null,
        resultSetsLost: null,
        error: `Punteggio non valido per il set ${i + 1}.`,
      };
    }
    if (us === them) {
      return {
        setScores: null,
        resultSetsWon: null,
        resultSetsLost: null,
        error: `Il set ${i + 1} non può terminare in parità.`,
      };
    }
    setScores.push({ us, them });
  }

  if (setScores.length === 0) {
    return { setScores: null, resultSetsWon: null, resultSetsLost: null };
  }

  const resultSetsWon = setScores.filter((s) => s.us > s.them).length;
  const resultSetsLost = setScores.filter((s) => s.us < s.them).length;
  const max = Math.max(resultSetsWon, resultSetsLost);
  const min = Math.min(resultSetsWon, resultSetsLost);
  if (max !== 3 || min >= 3) {
    return {
      setScores: null,
      resultSetsWon: null,
      resultSetsLost: null,
      error: "Risultato non valido: una squadra deve arrivare a 3 set.",
    };
  }

  return { setScores, resultSetsWon, resultSetsLost };
}

/** Come validateSetScorePairs, ma legge le coppie direttamente da un form
 * con campi ripetuti "setUs"/"setThem" (la griglia fissa a 5 set usata per
 * il risultato di una partita non-torneo o di un pronostico non-torneo). */
export function parseSetScoresFromFormData(formData: FormData): ParsedSetScores {
  const usValues = formData.getAll("setUs").map((v) => v.toString());
  const themValues = formData.getAll("setThem").map((v) => v.toString());
  const count = Math.max(usValues.length, themValues.length);
  const pairs = Array.from({ length: count }, (_, i) => ({ us: usValues[i] ?? "", them: themValues[i] ?? "" }));
  return validateSetScorePairs(pairs);
}

export interface ParsedTournamentGames {
  tournamentGames: TournamentGame[] | null;
  error?: string;
}

/**
 * Legge la lista ripetibile "partita del torneo" (avversaria + punteggio per
 * set) da un `<input type="hidden">` JSON, un blocco per avversaria
 * realmente affrontata. Un blocco completamente vuoto (nessuna avversaria,
 * nessun punteggio) viene ignorato; un'avversaria senza punteggio è valida
 * solo per il risultato reale ("sappiamo contro chi ma non ancora il
 * risultato" — `requireCompleteScore: false`), mentre per un pronostico
 * (`requireCompleteScore: true`) un punteggio mancante o incompleto fa
 * scartare silenziosamente quella partita invece di bloccare il salvataggio.
 */
export function parseTournamentGamesJson(
  json: string,
  options: { requireCompleteScore: boolean },
): ParsedTournamentGames {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { tournamentGames: null, error: "Dati del torneo non validi." };
  }
  if (!Array.isArray(raw)) {
    return { tournamentGames: null, error: "Dati del torneo non validi." };
  }

  const games: TournamentGame[] = [];
  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i] as { opponent?: unknown; setUs?: unknown; setThem?: unknown } | null;
    const opponent = typeof entry?.opponent === "string" ? entry.opponent.trim() : "";
    const setUs = Array.isArray(entry?.setUs) ? entry.setUs.map((v) => String(v)) : [];
    const setThem = Array.isArray(entry?.setThem) ? entry.setThem.map((v) => String(v)) : [];
    const count = Math.max(setUs.length, setThem.length);
    const pairs = Array.from({ length: count }, (_, j) => ({ us: setUs[j] ?? "", them: setThem[j] ?? "" }));
    const hasAnyScoreInput = pairs.some((p) => p.us.trim() || p.them.trim());

    if (!opponent && !hasAnyScoreInput) continue;
    if (!opponent) {
      return { tournamentGames: null, error: `Inserisci il nome dell'avversaria per la partita ${i + 1}.` };
    }

    const result = validateSetScorePairs(pairs);
    if (options.requireCompleteScore) {
      if (!result.setScores) continue;
      games.push({ id: crypto.randomUUID(), opponent, setScores: result.setScores });
    } else {
      if (result.error) {
        return { tournamentGames: null, error: `${result.error} (vs ${opponent})` };
      }
      games.push({ id: crypto.randomUUID(), opponent, setScores: result.setScores ?? [] });
    }
  }

  return { tournamentGames: games.length > 0 ? games : null };
}
