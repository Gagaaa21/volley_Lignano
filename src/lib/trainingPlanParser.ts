export interface ParsedBlock {
  title: string;
  durationMinutes: number;
  content: string;
}

export interface ParsedTrainingText {
  preamble: string;
  blocks: ParsedBlock[];
}

// Riconosce righe come "1. FOAM ROLL + ELASTICI – 10'" oppure "2. Riscaldamento - 15 min"
const HEADING_RE = /^\d+[.)]\s*(.+?)\s*[–—-]\s*(\d+)\s*(?:['’′]|min(?:uti)?\.?)?\s*$/i;
const TOTAL_RE = /^totale\b/i;

/**
 * Divide un testo di allenamento incollato in "macro blocchi": ogni blocco
 * inizia con una riga tipo "N. TITOLO – durata" e raccoglie le righe
 * successive come contenuto, fino al blocco successivo.
 */
export function parseTrainingPlanText(raw: string): ParsedTrainingText {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const blocks: ParsedBlock[] = [];
  const preambleLines: string[] = [];
  let current: { title: string; durationMinutes: number; lines: string[] } | null = null;

  const pushCurrent = () => {
    if (current) {
      blocks.push({
        title: current.title,
        durationMinutes: current.durationMinutes,
        content: current.lines.join("\n").trim(),
      });
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (TOTAL_RE.test(trimmed)) continue;

    const match = trimmed.match(HEADING_RE);
    if (match) {
      pushCurrent();
      current = { title: match[1].trim(), durationMinutes: Number(match[2]), lines: [] };
    } else if (current) {
      current.lines.push(line);
    } else if (trimmed) {
      preambleLines.push(line);
    }
  }
  pushCurrent();

  return { preamble: preambleLines.join("\n").trim(), blocks };
}
