import type { SheetNumbers, SheetPointsWon, SheetSetMark, SheetTeam } from "./sheet";
import type { ScoutLevel } from "./types";

/**
 * Come si scrive il tabellino in stile ufficiale (src/lib/scout/sheet.ts): le colonne, i numeri e la legenda. Stanno qui, senza
 * grafica, perché li usano insieme la pagina e il PDF: così i due non possono mostrare numeri diversi. Come nei tabellini delle
 * leghe lo zero è un punto « . »; il trattino «–» vuol dire che a quel livello non si segna.
 */

export const ZERO = ".";
export const NOT_TRACKED = "–";

/** Un conteggio: il punto se è zero. */
export function sheetCount(value: number | null): string {
  if (value === null) return NOT_TRACKED;
  return value === 0 ? ZERO : String(value);
}

/** Una percentuale: «–» se non si segna, il punto se non c'è niente su cui calcolarla. */
export function sheetPercent(value: number | null, tracked: boolean, brackets = false): string {
  if (!tracked) return NOT_TRACKED;
  if (value === null) return ZERO;
  return brackets ? `(${value}%)` : `${value}%`;
}

/** Un saldo con il segno («+3», «-2»), il punto se è zero. */
export function sheetBalance(value: number): string {
  if (value === 0) return ZERO;
  return value > 0 ? `+${value}` : `-${Math.abs(value)}`;
}

/** Un punteggio: «25–15». */
export function sheetScore(score: { us: number; opp: number }): string {
  return `${score.us}–${score.opp}`;
}

/** Una durata: «27'» o «1 h 18'». */
export function sheetMinutes(minutes: number | null): string {
  if (minutes === null) return NOT_TRACKED;
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}'` : `${minutes}'`;
}

/** Il segno di un set, a parole (per chi legge con lo screen reader e per i titoli). */
export function setMarkLabel(mark: SheetSetMark, set: number): string {
  if (mark === null) return `${set}° set: non ha giocato`;
  if (mark === "in") return `${set}° set: entrata`;
  return `${set}° set: in campo dalla posizione ${mark}`;
}

export interface SheetColumn {
  key: string;
  group: "Punti" | "Battuta" | "Ricezione" | "Attacco" | "Muro";
  label: string;
  title: string;
  /** Il testo della cella; `team` dice cosa si segna per quella squadra. */
  text: (row: SheetNumbers, team: Pick<SheetTeam, "tracksReceptions" | "tracksAttacks">) => string;
  /** Una riga verticale a sinistra: comincia un gruppo. */
  first?: boolean;
  /** Il numero che conta di più del gruppo (in grassetto). */
  strong?: boolean;
}

export const SHEET_COLUMNS: SheetColumn[] = [
  { key: "punti-tot", group: "Punti", label: "Tot", title: "Punti fatti: attacchi vincenti, muri e ace", text: (r) => sheetCount(r.points), first: true, strong: true },
  { key: "punti-bp", group: "Punti", label: "BP", title: "Di quei punti, quelli fatti mentre la propria squadra batteva (break point)", text: (r) => sheetCount(r.bp) },
  { key: "punti-vp", group: "Punti", label: "V-P", title: "Punti fatti meno errori e attacchi murati", text: (r) => sheetBalance(r.balance) },
  { key: "battuta-tot", group: "Battuta", label: "Tot", title: "Battute", text: (r) => sheetCount(r.serves), first: true },
  { key: "battuta-err", group: "Battuta", label: "Err", title: "Battute sbagliate", text: (r) => sheetCount(r.serveErrors) },
  { key: "battuta-pt", group: "Battuta", label: "Pt", title: "Ace", text: (r) => sheetCount(r.aces) },
  { key: "ricezione-tot", group: "Ricezione", label: "Tot", title: "Ricezioni segnate", text: (r) => sheetCount(r.receptions), first: true },
  { key: "ricezione-err", group: "Ricezione", label: "Err", title: "Ricezioni sbagliate", text: (r) => sheetCount(r.receptionErrors) },
  { key: "ricezione-pos", group: "Ricezione", label: "Pos%", title: "Ricezioni positive (# e +) su quelle segnate", text: (r, t) => sheetPercent(r.positivePct, t.tracksReceptions) },
  { key: "ricezione-prf", group: "Ricezione", label: "(Prf%)", title: "Ricezioni perfette (#) su quelle segnate", text: (r, t) => sheetPercent(r.perfectPct, t.tracksReceptions, true) },
  { key: "attacco-tot", group: "Attacco", label: "Tot", title: "Attacchi segnati", text: (r) => sheetCount(r.attacks), first: true },
  { key: "attacco-err", group: "Attacco", label: "Err", title: "Attacchi sbagliati", text: (r) => sheetCount(r.attackErrors) },
  { key: "attacco-mur", group: "Attacco", label: "Mur", title: "Attacchi murati dall'avversaria", text: (r) => sheetCount(r.blocked) },
  { key: "attacco-pt", group: "Attacco", label: "Pt", title: "Attacchi vincenti", text: (r) => sheetCount(r.kills), strong: true },
  { key: "attacco-pct", group: "Attacco", label: "Pt%", title: "Attacchi vincenti su quelli segnati", text: (r, t) => sheetPercent(r.killPct, t.tracksAttacks) },
  { key: "muro-pt", group: "Muro", label: "Pt", title: "Muri vincenti", text: (r) => sheetCount(r.blocks), first: true },
];

/** I gruppi delle colonne con quante ne prendono, per la prima riga dell'intestazione. */
export function sheetGroups(): { name: SheetColumn["group"]; span: number }[] {
  const groups: { name: SheetColumn["group"]; span: number }[] = [];
  for (const column of SHEET_COLUMNS) {
    const last = groups[groups.length - 1];
    if (last && last.name === column.group) last.span += 1;
    else groups.push({ name: column.group, span: 1 });
  }
  return groups;
}

/** Le quattro voci dei punti vinti in un set, nell'ordine dei tabellini ufficiali. */
export const POINTS_WON: { key: keyof SheetPointsWon; label: string; title: string }[] = [
  { key: "ace", label: "Bat", title: "Punti in battuta (ace)" },
  { key: "attack", label: "Att", title: "Punti in attacco" },
  { key: "block", label: "Mu", title: "Punti a muro" },
  { key: "gifts", label: "Er.Av", title: "Punti da errori dell'avversaria" },
];

/** La legenda del tabellino (stesse parole nella pagina e nel PDF: niente simboli che il font del PDF non ha). */
export const SHEET_LEGEND: [string, string][] = [
  ["BP", "Break point: punti fatti mentre la propria squadra batteva"],
  ["V-P", "Vinti - persi: punti fatti meno errori e attacchi murati"],
  ["Pt", "Punti"],
  ["Err", "Errori"],
  ["Mur", "Murati"],
  ["Pos%", "Ricezioni positive (# e +)"],
  ["Prf%", "Ricezioni perfette (#)"],
  ["Er.Av", "Punti da errori dell'avversaria"],
  ["CP", "Cambio palla: punti fatti in ricezione"],
];

/** Cosa vuol dire un numero o un segno nella colonna dei set e nelle celle. */
export const SHEET_MARKS: [string, string][] = [
  ["n", "posizione di partenza nel set (1 = in battuta)"],
  ["entrata", "è entrata nel set (o è la libero; senza formazione: ha fatto qualcosa)"],
  ["set cerchiato", "la squadra ha battuto per prima"],
  [".", "zero"],
  ["–", "a questo livello non si segna"],
];

/** La nota sotto al tabellino: cosa manca, a seconda del livello. */
export function sheetFootnote(level: ScoutLevel): string {
  const always =
    "Risultato calcolato con lo scout, non ufficiale. Le battute di ogni giocatrice si contano quando si segue la formazione (o si segnano le battute); il totale della squadra c'è sempre. Le durate sono stimate dall'ora del primo e dell'ultimo punto.";
  if (level === "base") return `${always} A livello Base non si segnano ricezioni e attacchi tentati: le loro colonne restano vuote.`;
  if (level === "ricezioni") return `${always} A livello Con ricezioni si segnano le ricezioni nostre (non quelle dell'avversaria) ma non gli attacchi tentati.`;
  return `${always} A livello Completo le percentuali sono sui tocchi segnati.`;
}
