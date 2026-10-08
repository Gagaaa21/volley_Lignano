/** Una parte del testo di un blocco: elenco puntato, elenco numerato o paragrafo. */
export type BlockContentPart =
  | { kind: "bullets"; items: string[] }
  | { kind: "numbered"; items: { number: number; text: string }[] }
  | { kind: "text"; lines: string[] };

/**
 * Divide il testo di un blocco in paragrafi (separati da una riga vuota) e
 * riconosce gli elenchi: righe con "-"/"*" diventano punti, righe con "1."
 * o "1)" un elenco numerato che tiene i numeri scritti dall'allenatore.
 */
export function parseBlockContent(content: string): BlockContentPart[] {
  return content
    .split(/\n\s*\n/)
    .map((paragraph) =>
      paragraph
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    )
    .filter((lines) => lines.length > 0)
    .map((lines): BlockContentPart => {
      if (lines.every((l) => /^[*-]\s+/.test(l))) {
        return { kind: "bullets", items: lines.map((l) => l.replace(/^[*-]\s+/, "")) };
      }
      if (lines.every((l) => /^\d+[.)]\s+/.test(l))) {
        return {
          kind: "numbered",
          items: lines.map((l) => ({ number: Number(l.match(/^(\d+)/)![1]), text: l.replace(/^\d+[.)]\s+/, "") })),
        };
      }
      return { kind: "text", lines };
    });
}
