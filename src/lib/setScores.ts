import "server-only";
import type { SetScore } from "@/lib/types";

export interface ParsedSetScores {
  setScores: SetScore[] | null;
  resultSetsWon: number | null;
  resultSetsLost: number | null;
  error?: string;
}

/**
 * Deriva set vinti/persi dai parziali inseriti in un form (es. "25-20"), set
 * per set — usata sia per il risultato reale di una partita (Partite) sia
 * per un pronostico (Pronostici), che condividono la stessa identica
 * griglia a 5 righe e la stessa regola di validità: una squadra deve
 * arrivare esattamente a 3 set vinti, nessun set in parità. Righe lasciate
 * completamente in bianco vengono ignorate (set non giocato/non
 * pronosticato), non contano come errore finché almeno un set completo è
 * stato inserito.
 */
export function parseSetScoresFromFormData(formData: FormData): ParsedSetScores {
  const usValues = formData.getAll("setUs").map((v) => v.toString().trim());
  const themValues = formData.getAll("setThem").map((v) => v.toString().trim());
  const count = Math.max(usValues.length, themValues.length);

  const setScores: SetScore[] = [];
  for (let i = 0; i < count; i++) {
    const usRaw = usValues[i] ?? "";
    const themRaw = themValues[i] ?? "";
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
