export interface ParsedBlock {
  title: string;
  durationMinutes: number;
  content: string;
}

export interface ParsedTrainingText {
  preamble: string;
  blocks: ParsedBlock[];
}

// Riconosce righe come "1. FOAM ROLL + ELASTICI – 10'", "2. Riscaldamento - 15 min"
// oppure "3. Circuito fisico – circa 60'" (durata approssimativa) e titoli che
// contengono a loro volta un trattino, es. "5. Gioco finale – attacco + muro – 30'".
const HEADING_RE =
  /^\d+[.)]\s*(.+?)\s*[–—-]\s*(?:circa\s*|ca\.?\s*|~\s*)?(\d+)\s*(?:['’′]|min(?:uti)?\.?)?\s*$/i;

// Riconosce un sotto-esercizio dentro una sezione più ampia, introdotto dalla
// propria durata invece che da un numero: "5' – Palleggio spinto da zona 1 →
// zona 5". A differenza di HEADING_RE, qui la durata viene prima del titolo:
// sono esercizi distinti da svolgere in sequenza (non stazioni a rotazione),
// ognuno con il proprio titolo e la propria durata.
const SUB_HEADING_RE = /^(\d+)\s*(?:['’′]|min(?:uti)?\.?)\s*[–—-]\s*(.+?)\s*$/i;

const TOTAL_RE = /^totale\b/i;

/**
 * Divide un testo di allenamento incollato in blocchi: ogni blocco inizia
 * con una riga "N. TITOLO – durata" oppure "durata – TITOLO" (sotto-esercizio)
 * e raccoglie le righe successive come contenuto, fino al blocco successivo.
 * Una riga "N. TITOLO – durata" seguita subito da sotto-esercizi (nessun
 * contenuto proprio prima del successivo titolo) è solo un'etichetta di
 * sezione — es. "3. RICEZIONE – 30'" che introduce cinque esercizi da 5-10
 * minuti ciascuno — e non genera un blocco a sé: i suoi minuti sono già la
 * somma dei sotto-esercizi che seguono, creati come blocchi separati.
 */
export function parseTrainingPlanText(raw: string): ParsedTrainingText {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const blocks: ParsedBlock[] = [];
  const preambleLines: string[] = [];
  let current: { title: string; durationMinutes: number; lines: string[] } | null = null;

  const pushCurrent = () => {
    if (!current) return;
    const content = current.lines.join("\n").trim();
    if (content) blocks.push({ title: current.title, durationMinutes: current.durationMinutes, content });
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (TOTAL_RE.test(trimmed)) continue;

    const headingMatch = trimmed.match(HEADING_RE);
    const subMatch = !headingMatch ? trimmed.match(SUB_HEADING_RE) : null;

    if (headingMatch) {
      pushCurrent();
      current = { title: headingMatch[1].trim(), durationMinutes: Number(headingMatch[2]), lines: [] };
    } else if (subMatch) {
      pushCurrent();
      current = { title: subMatch[2].trim(), durationMinutes: Number(subMatch[1]), lines: [] };
    } else if (current) {
      current.lines.push(line);
    } else if (trimmed) {
      preambleLines.push(line);
    }
  }
  pushCurrent();

  return { preamble: preambleLines.join("\n").trim(), blocks };
}
