/** Uniforma un nome scritto a mano (spazi doppi, maiuscole/minuscole) così
 * che la stessa persona, segnata in allenamenti diversi, conti come la
 * stessa voce a prescindere da come è stata digitata quella volta. Usato dal
 * registro presenze del Minivolley, che non ha un'anagrafica: il nome
 * stesso è la chiave del record. */
export function normalizePersonName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word))
    .join(" ");
}

function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i++) dp[i][0] = i;
  for (let j = 0; j < cols; j++) dp[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[rows - 1][cols - 1];
}

/** Nomi già usati in passato "simili" a quanto si sta digitando: prima i
 * contenimenti diretti (es. "sof" in "Sofia Rossi"), poi quelli a distanza
 * di modifica ridotta (per intercettare refusi tipo "Sofia Rosi"). */
export function suggestSimilarNames(query: string, knownNames: string[], limit = 5): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const scored = knownNames
    .map((name) => {
      const normalized = name.toLowerCase();
      if (normalized.includes(q)) return { name, score: 0 };
      const distance = levenshteinDistance(q, normalized.slice(0, q.length + 3));
      return { name, score: distance };
    })
    .filter((entry) => entry.score <= Math.max(2, Math.ceil(q.length * 0.4)));

  scored.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
  return scored.slice(0, limit).map((entry) => entry.name);
}
