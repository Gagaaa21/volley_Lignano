import { percent, sumDetails, type PlayerStats } from "./stats";
import type { ScoutLevel } from "./types";

/**
 * Le colonne del tabellino di una squadra, per livello. Stanno qui, senza
 * grafica, perché le usano insieme la pagina (src/components/scout/ScoutTables)
 * e il PDF (src/lib/pdf/scoutPdf): così i due non possono mostrare numeri diversi.
 */

/** I numeri di una riga del tabellino: una giocatrice, oppure il totale della squadra. */
export type Row = Pick<
  PlayerStats,
  "points" | "bp" | "balance" | "aces" | "serveErrors" | "receptionErrors" | "kills" | "attackErrors" | "blocked" | "stuffs" | "blockErrors" | "otherErrors" | "detail"
>;

export function totalOf(players: PlayerStats[]): Row {
  const total: Row = {
    points: 0,
    bp: 0,
    balance: 0,
    aces: 0,
    serveErrors: 0,
    receptionErrors: 0,
    kills: 0,
    attackErrors: 0,
    blocked: 0,
    stuffs: 0,
    blockErrors: 0,
    otherErrors: 0,
    detail: sumDetails(players),
  };
  for (const p of players) {
    for (const key of Object.keys(total) as (keyof Row)[]) {
      if (key !== "detail") total[key] += p[key];
    }
  }
  return total;
}

/**
 * Come si legge una colonna: «count» un numero (trattino se zero), «strong» un
 * numero in evidenza, «minus» un errore (rosso se c'è), «balance» un saldo con
 * segno, «pct» una percentuale.
 */
export type Kind = "count" | "strong" | "minus" | "balance" | "pct";

export interface Column {
  group: string;
  label: string;
  title: string;
  kind: Kind;
  value: (row: Row) => number | null;
  /** Una riga verticale a sinistra: comincia un gruppo. */
  sep?: boolean;
  /** L'intestazione nel PDF, dove le colonne sono più strette e i gruppi si abbreviano. */
  pdf: string;
}

const sumGrades = (row: Row) => row.detail.receptions;
const positive = (row: Row) => row.detail.reception["#"] + row.detail.reception["+"];

const POINTS: Column[] = [
  { group: "Punti", label: "Tot", title: "Punti fatti: attacchi vincenti, muri e ace", kind: "strong", value: (r) => r.points, sep: true, pdf: "Punti" },
  { group: "Punti", label: "BP", title: "Punti fatti mentre la propria squadra batteva (break point)", kind: "count", value: (r) => r.bp, pdf: "BP" },
  { group: "Punti", label: "V‑P", title: "Punti fatti meno errori e attacchi murati", kind: "balance", value: (r) => r.balance, pdf: "V-P" },
];

const SERVE_SHORT: Column[] = [
  { group: "Battuta", label: "Ace", title: "Battute vincenti", kind: "count", value: (r) => r.aces, sep: true, pdf: "Batt Ace" },
  { group: "Battuta", label: "Err", title: "Battute sbagliate", kind: "minus", value: (r) => r.serveErrors, pdf: "Batt Err" },
];

const RECEPTION_SHORT: Column[] = [
  { group: "Ricez.", label: "Err", title: "Ricezioni sbagliate", kind: "minus", value: (r) => r.receptionErrors, sep: true, pdf: "Ricez. Err" },
];

const RECEPTION_FULL: Column[] = [
  { group: "Ricezione", label: "Tot", title: "Ricezioni segnate", kind: "count", value: sumGrades, sep: true, pdf: "Ric Tot" },
  { group: "Ricezione", label: "Err", title: "Ricezioni sbagliate", kind: "minus", value: (r) => r.receptionErrors, pdf: "Ric Err" },
  { group: "Ricezione", label: "Pos%", title: "Ricezioni positive (# e +) su quelle segnate", kind: "pct", value: (r) => percent(positive(r), sumGrades(r)), pdf: "Ric Pos%" },
  { group: "Ricezione", label: "Prf%", title: "Ricezioni perfette (#) su quelle segnate", kind: "pct", value: (r) => percent(r.detail.reception["#"], sumGrades(r)), pdf: "Ric Prf%" },
];

const ATTACK_SHORT: Column[] = [
  { group: "Attacco", label: "Pt", title: "Attacchi vincenti", kind: "count", value: (r) => r.kills, sep: true, pdf: "Att Pt" },
  { group: "Attacco", label: "Err", title: "Attacchi sbagliati", kind: "minus", value: (r) => r.attackErrors, pdf: "Att Err" },
  { group: "Attacco", label: "Mur", title: "Attacchi murati dall'avversaria", kind: "minus", value: (r) => r.blocked, pdf: "Att Mur" },
];

const BLOCK: Column[] = [
  { group: "Muro", label: "Pt", title: "Muri vincenti", kind: "count", value: (r) => r.stuffs, sep: true, pdf: "Muro Pt" },
  { group: "Muro", label: "Err", title: "Errori a muro", kind: "minus", value: (r) => r.blockErrors, pdf: "Muro Err" },
];

const OTHER_SHORT: Column[] = [
  { group: "Altri", label: "Err", title: "Alzate e difese sbagliate, falli fischiati", kind: "minus", value: (r) => r.otherErrors, sep: true, pdf: "Altri Err" },
];

/** Le colonne del tabellino per livello: il livello Base ha quelle che sa riempire, «Con ricezioni» aggiunge la ricezione. */
export function columnsFor(level: ScoutLevel): Column[] {
  if (level === "ricezioni") return [...POINTS, ...SERVE_SHORT, ...RECEPTION_FULL, ...ATTACK_SHORT, ...BLOCK, ...OTHER_SHORT];
  return [...POINTS, ...SERVE_SHORT, ...RECEPTION_SHORT, ...ATTACK_SHORT, ...BLOCK, ...OTHER_SHORT];
}

export function formatPercent(value: number | null): string {
  if (value === null) return "–";
  return `${value}%`;
}

/** Un saldo con il segno: +3, −2, 0. */
export function signedNumber(value: number): string {
  if (value > 0) return `+${value}`;
  if (value < 0) return `−${Math.abs(value)}`;
  return "0";
}


/** Il testo di una cella: `–` dove non c'è niente da dire. Nel PDF (`ascii`) il meno è il trattino normale. */
export function cellText(column: Column, row: Row, options: { ascii?: boolean } = {}): string {
  const value = column.value(row);
  if (column.kind === "pct") return formatPercent(value);
  const n = value ?? 0;
  if (column.kind === "balance") return options.ascii ? (n > 0 ? `+${n}` : n < 0 ? `-${Math.abs(n)}` : "0") : signedNumber(n);
  return String(n);
}
