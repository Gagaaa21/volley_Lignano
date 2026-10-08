export interface ParsedBlock {
  title: string;
  /** Minuti; 0 se l'intestazione non indica una durata. */
  durationMinutes: number;
  content: string;
}

export interface ParsedTrainingText {
  preamble: string;
  blocks: ParsedBlock[];
}

/** Riga che apre un blocco, come l'ha indicata l'IA: la riga stessa, titolo e durata. */
export interface BlockHeading {
  headingLine: string;
  title: string;
  durationMinutes: number;
}

// Riconosce righe come "1. FOAM ROLL + ELASTICI – 10'", "2. Riscaldamento - 15 min"
// oppure "3. Circuito fisico – circa 60'" (durata approssimativa) e titoli che
// contengono a loro volta un trattino, es. "5. Gioco finale – attacco + muro – 30'".
const HEADING_RE =
  /^\d+[.)]\s*(.+?)\s*[–—-]\s*(?:circa\s*|ca\.?\s*|~\s*)?(\d+)\s*(?:['’′]|min(?:uti)?\.?)?\s*$/i;
// Sezioni con una lettera e la durata prima del titolo: "A – 45’ LAVORO ANALITICO SULL’ATTACCO".
// Serve la lettera: "5' – Palleggio spinto" (esercizio breve dentro un blocco) non è un'intestazione.
const LETTER_HEADING_RE =
  /^[A-Z][.)]?\s*[–—-]\s*(?:circa\s*|ca\.?\s*|~\s*)?(\d+)\s*(?:['’′]|min(?:uti)?\.?)\s*[–—:-]?\s*(\S.*)$/;
export const TOTAL_RE = /^totale\b/i;

function matchHeading(line: string): { title: string; durationMinutes: number } | null {
  const numbered = line.match(HEADING_RE);
  if (numbered) return { title: numbered[1].trim(), durationMinutes: Number(numbered[2]) };
  const lettered = line.match(LETTER_HEADING_RE);
  if (lettered) return { title: lettered[2].trim(), durationMinutes: Number(lettered[1]) };
  return null;
}

/**
 * Divide un testo di allenamento incollato in "macro blocchi" con regole
 * fisse: ogni blocco inizia con una riga tipo "N. TITOLO – durata" (o
 * "A – durata TITOLO") e raccoglie le righe successive come contenuto, fino
 * al blocco successivo. È il ripiego quando l'IA non è disponibile.
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

    const heading = matchHeading(trimmed);
    if (heading) {
      pushCurrent();
      current = { ...heading, lines: [] };
    } else if (current) {
      current.lines.push(line);
    } else if (trimmed) {
      preambleLines.push(line);
    }
  }
  pushCurrent();

  return { preamble: preambleLines.join("\n").trim(), blocks };
}

/** Testo pronto per la divisione: a capo uniformi, senza le righe "Totale …". */
export function cleanTrainingText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => !TOTAL_RE.test(line.trim()))
    .join("\n")
    .trim();
}

/** Per confrontare due righe senza badare a spazi, maiuscole, apostrofi e trattini diversi. */
function normalizeLine(line: string): string {
  return line
    .normalize("NFKC")
    .replace(/[‘’′`´]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Solo lettere e cifre: per capire se un titolo usa le parole della sua intestazione. */
function wordsOnly(text: string): string {
  return normalizeLine(text).replace(/[^\p{L}\p{N}]+/gu, "");
}

/** Titolo ricavato dalla riga di intestazione: senza numero/lettera iniziale né durata. */
export function titleFromHeadingLine(line: string): string {
  const heading = matchHeading(line.trim());
  if (heading) return heading.title;
  return (
    line
      .trim()
      // "1.", "2)", "3 -", "A –", "B." all'inizio (non la "A" di "A coppie …")
      .replace(/^(?:\d+\s*[.)]|\d+\s+[–—:-]|[A-Z]\s*[.)]|[A-Z]\s+[–—:-])\s*[–—:-]?\s*/, "")
      // durata in fondo: "– 15'", "(20 min)", "circa 60'"
      .replace(/\s*[–—-]?\s*\(?\s*(?:circa\s*|ca\.?\s*|~\s*)?\d+\s*(?:['’′]|min(?:uti)?\.?)\s*\)?\s*$/i, "")
      // durata all'inizio: "45' LAVORO …"
      .replace(/^(?:circa\s*|ca\.?\s*|~\s*)?\d+\s*(?:['’′]|min(?:uti)?\.?)\s*[–—:-]?\s*/i, "")
      .trim() || line.trim()
  );
}

/**
 * Divide il testo alle righe di intestazione indicate (nell'ordine in cui
 * compaiono). Il contenuto di ogni blocco è ritagliato dal testo originale,
 * mai riscritto. Ritorna null se una riga non si trova nel testo: vuol dire
 * che chi l'ha indicata (l'IA) l'ha alterata, e il risultato non è affidabile.
 */
export function splitAtHeadings(text: string, headings: BlockHeading[]): ParsedTrainingText | null {
  if (headings.length === 0) return null;
  const lines = text.split("\n");
  const normalized = lines.map(normalizeLine);

  const positions: number[] = [];
  let cursor = 0;
  for (const { headingLine } of headings) {
    const target = normalizeLine(headingLine);
    if (!target) return null;
    let found = -1;
    for (let i = cursor; i < lines.length; i++) {
      if (normalized[i] === target) {
        found = i;
        break;
      }
    }
    if (found === -1) return null;
    positions.push(found);
    cursor = found + 1;
  }

  const blocks: ParsedBlock[] = positions.map((position, i) => {
    const heading = headings[i];
    const line = lines[position];
    // Il titolo deve usare le parole dell'intestazione; altrimenti lo si ricava dalla riga stessa.
    const proposed = heading.title.trim();
    const title = proposed && wordsOnly(line).includes(wordsOnly(proposed)) ? proposed : titleFromHeadingLine(line);
    const duration = Number.isFinite(heading.durationMinutes) ? Math.round(heading.durationMinutes) : 0;
    return {
      title,
      durationMinutes: duration > 0 && duration <= 600 ? duration : 0,
      content: lines
        .slice(position + 1, positions[i + 1] ?? lines.length)
        .join("\n")
        .trim(),
    };
  });

  return { preamble: lines.slice(0, positions[0]).join("\n").trim(), blocks };
}

/**
 * Testo di una scheda già salvata, ricostruito come se fosse stato incollato:
 * una riga "N. Titolo – durata'" per blocco seguita dal suo contenuto. Serve a
 * ridividere le schede salvate quando la divisione non era giusta.
 */
export function planBlocksToText(blocks: ParsedBlock[]): string {
  return blocks
    .map((block, i) => {
      const heading = `${i + 1}. ${block.title}${block.durationMinutes > 0 ? ` – ${block.durationMinutes}'` : ""}`;
      return block.content.trim() ? `${heading}\n${block.content.trim()}` : heading;
    })
    .join("\n\n");
}

/** Le due divisioni sono uguali (stessi titoli, durate e contenuti, a meno di spazi)? */
export function sameDivision(a: ParsedBlock[], b: ParsedBlock[]): boolean {
  if (a.length !== b.length) return false;
  const key = (block: ParsedBlock) =>
    `${normalizeLine(block.title)}|${block.durationMinutes}|${normalizeLine(block.content.replace(/\n/g, " "))}`;
  return a.every((block, i) => key(block) === key(b[i]));
}
