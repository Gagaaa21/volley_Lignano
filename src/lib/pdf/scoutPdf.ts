import { clip, endPath, popGraphicsState, pushGraphicsState, rectangle } from "pdf-lib";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { matchTitle } from "@/lib/calendar";
import { CATEGORY_LABELS } from "@/lib/category";
import { PdfReport, type PdfCanvas, type PdfCell, type PdfCellInput, type PdfColumn } from "@/lib/pdf/report";
import { deriveScout } from "@/lib/scout/derive";
import { ERROR_HOWS, HOW_META } from "@/lib/scout/rules";
import { computeStats, hasActivity, percent, pointsFromErrors, type PlayerStats, type SetSummary, type TeamStats } from "@/lib/scout/stats";
import type { ScoutData } from "@/lib/scout/types";
import type { Match } from "@/lib/types";

/**
 * Il tabellino di una partita in PDF (A4 orizzontale): parziali, come si è
 * fatto punto, errori e falli, andamento del punteggio e una tabella per
 * squadra con i numeri di ogni giocatrice. Stessi conti della pagina
 * «Tabellino» (src/lib/scout/stats.ts).
 */

export interface ScoutPdfInput {
  match: Match;
  scout: ScoutData;
  /** Solo i punti di questo set (1 = primo), o null per tutta la partita. */
  set: number | null;
  generatedAt?: Date;
}

const dash: PdfCell = { text: "–", tone: "muted" };

function count(value: number): PdfCellInput {
  return value === 0 ? dash : String(value);
}

function signed(value: number): string {
  if (value > 0) return `+${value}`;
  if (value < 0) return `-${Math.abs(value)}`;
  return "0";
}

function ratio(part: number, total: number): string {
  return total === 0 ? "–" : `${part} su ${total} (${percent(part, total)}%)`;
}

function minutesText(minutes: number): string {
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}'` : `${minutes}'`;
}

// ── grafico dell'andamento ──────────────────────────────────────────────

const FLOW_HEIGHT = 120;
const FLOW_GAP = 3;

/** Di quanto è avanti una squadra dopo ogni punto, set per set: sopra la linea centrale noi, sotto loro. */
function drawFlow(canvas: PdfCanvas, sets: SetSummary[]) {
  const { page, top, height, fonts, colors, safe } = canvas;
  const played = sets.filter((set) => set.rallies > 0);
  if (played.length === 0) return;

  // A sinistra una fascia per i numeri del vantaggio, il grafico occupa il resto.
  const gutter = 24;
  const left = canvas.left + gutter;
  const width = canvas.width - gutter;
  const labelHeight = 14;
  const plotHeight = height - labelHeight;
  const half = plotHeight / 2 - 2;
  const mid = top - labelHeight - plotHeight / 2;
  const totalUnits = played.reduce((sum, set) => sum + set.rallies, 0) + FLOW_GAP * (played.length - 1);
  const maxAbs = Math.max(4, ...played.flatMap((set) => set.flow.map((value) => Math.abs(value))));
  const range = Math.ceil(maxAbs / 4) * 4;
  const x = (unit: number) => (unit / totalUnits) * width;
  const dy = (diff: number) => (diff / range) * half;

  for (const value of [-range, -range / 2, range / 2, range]) {
    page.drawLine({
      start: { x: left, y: mid + dy(value) },
      end: { x: left + width, y: mid + dy(value) },
      thickness: 0.4,
      color: colors.border,
      dashArray: [2, 3],
    });
    const label = value > 0 ? `+${value}` : `-${Math.abs(value)}`;
    page.drawText(label, {
      x: left - 4 - fonts.regular.widthOfTextAtSize(label, 6.5),
      y: mid + dy(value) - 2.5,
      size: 6.5,
      font: fonts.regular,
      color: colors.muted,
    });
  }
  page.drawLine({ start: { x: left, y: mid }, end: { x: left + width, y: mid }, thickness: 0.8, color: colors.muted });
  const zero = "0";
  page.drawText(zero, {
    x: left - 4 - fonts.regular.widthOfTextAtSize(zero, 6.5),
    y: mid - 2.5,
    size: 6.5,
    font: fonts.regular,
    color: colors.muted,
  });

  let offset = 0;
  for (const set of played) {
    const startUnit = offset;
    offset += set.rallies + FLOW_GAP;

    // Coordinate locali all'origine (left, mid): y verso il basso, come negli SVG.
    const points = set.flow.map((diff, i) => ({ x: x(startUnit + i), y: -dy(diff) }));
    const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
    const last = points[points.length - 1];
    const area = `${line} L${last.x.toFixed(2)},0 L${points[0].x.toFixed(2)},0 Z`;

    // L'area sopra la linea centrale è di chi è avanti tra noi, quella sotto di loro: due ritagli.
    page.pushOperators(pushGraphicsState(), rectangle(left, mid, width, half + 2), clip(), endPath());
    page.drawSvgPath(area, { x: left, y: mid, color: colors.primary, opacity: 0.3 });
    page.pushOperators(popGraphicsState());
    page.pushOperators(pushGraphicsState(), rectangle(left, mid - half - 2, width, half + 2), clip(), endPath());
    page.drawSvgPath(area, { x: left, y: mid, color: colors.accent, opacity: 0.45 });
    page.pushOperators(popGraphicsState());
    page.drawSvgPath(line, { x: left, y: mid, borderColor: colors.dark, borderWidth: 0.9 });

    const label = safe(`${set.n}° set  ${set.score.us}-${set.score.opp}`);
    const labelWidth = fonts.bold.widthOfTextAtSize(label, 8);
    page.drawText(label, {
      x: left + (x(startUnit) + x(startUnit + set.rallies)) / 2 - labelWidth / 2,
      y: top - 9,
      size: 8,
      font: fonts.bold,
      color: colors.ink,
    });
  }
}

// ── tabelle ─────────────────────────────────────────────────────────────

const PLAYER_COLUMNS: PdfColumn[] = [
  { header: "N°", weight: 0.55, align: "center" },
  { header: "Giocatrice", weight: 3.2 },
  { header: "Punti Tot", weight: 0.85, align: "center" },
  { header: "Punti BP", weight: 0.85, align: "center" },
  { header: "V-P", weight: 0.85, align: "center" },
  { header: "Battuta Ace", weight: 0.85, align: "center" },
  { header: "Battuta Err", weight: 0.85, align: "center" },
  { header: "Ricez. Err", weight: 0.85, align: "center" },
  { header: "Attacco Pt", weight: 0.85, align: "center" },
  { header: "Attacco Err", weight: 0.85, align: "center" },
  { header: "Attacco Mur", weight: 0.85, align: "center" },
  { header: "Muro Pt", weight: 0.85, align: "center" },
  { header: "Muro Err", weight: 0.85, align: "center" },
  { header: "Altri Err", weight: 0.85, align: "center" },
];

function balanceCell(value: number): PdfCell {
  return { text: signed(value), tone: value > 0 ? "success" : value < 0 ? "danger" : "muted" };
}

function playerRow(p: PlayerStats): PdfCellInput[] {
  return [
    { text: p.number ?? "–", bold: true, tone: p.number ? "default" : "muted" },
    { text: p.libero ? `${p.name} (L)` : p.name, bold: true, tone: p.id === "?" ? "muted" : "default" },
    { text: String(p.points), bold: true },
    count(p.bp),
    balanceCell(p.balance),
    count(p.aces),
    count(p.serveErrors),
    count(p.receptionErrors),
    count(p.kills),
    count(p.attackErrors),
    count(p.blocked),
    count(p.stuffs),
    count(p.blockErrors),
    count(p.otherErrors),
  ];
}

function totalRow(players: PlayerStats[]): PdfCellInput[] {
  const sum = (pick: (p: PlayerStats) => number) => players.reduce((total, p) => total + pick(p), 0);
  const bold = (value: number | string): PdfCell => ({ text: String(value), bold: true });
  return [
    "",
    { text: "Squadra", bold: true },
    bold(sum((p) => p.points)),
    bold(sum((p) => p.bp)),
    { text: signed(sum((p) => p.balance)), bold: true },
    bold(sum((p) => p.aces)),
    bold(sum((p) => p.serveErrors)),
    bold(sum((p) => p.receptionErrors)),
    bold(sum((p) => p.kills)),
    bold(sum((p) => p.attackErrors)),
    bold(sum((p) => p.blocked)),
    bold(sum((p) => p.stuffs)),
    bold(sum((p) => p.blockErrors)),
    bold(sum((p) => p.otherErrors)),
  ];
}

/** Titolo e tabella insieme: se non ci stanno nello spazio rimasto, vanno tutti in una pagina nuova. */
function tableSection(
  report: PdfReport,
  title: string,
  detail: string,
  columns: PdfColumn[],
  rows: PdfCellInput[][],
  emptyText?: string,
) {
  report.requireSpace(24 + (rows.length > 0 ? report.tableHeight(columns, rows) : 30));
  report.heading(title, detail);
  report.table(columns, rows, { keepTogether: true, emptyText });
}

function playerSection(report: PdfReport, title: string, side: "us" | "opp", players: PlayerStats[]) {
  const active = players.filter(hasActivity);
  const idle = players.filter((p) => !hasActivity(p));
  const rows = [...active.map(playerRow), totalRow(players)];
  // Titolo e tabella restano insieme: se non ci stanno nello spazio rimasto, vanno tutti in una pagina nuova.
  report.requireSpace(24 + report.tableHeight(PLAYER_COLUMNS, rows) + (idle.length > 0 ? 22 : 0));
  report.heading(title);
  report.table(PLAYER_COLUMNS, rows, {
    keepTogether: true,
    emptyText: side === "us" ? "Nessuna azione segnata." : "Nessuna azione segnata per l'avversaria.",
  });
  if (idle.length > 0) {
    report.text(`Senza azioni segnate: ${idle.map((p) => (side === "opp" ? `n. ${p.number ?? p.name}` : p.name)).join(", ")}.`, {
      size: 8,
      gapAfter: 10,
    });
  }
}

function howRows(us: TeamStats, opp: TeamStats): PdfCellInput[][] {
  const row = (label: string, a: PdfCellInput, b: PdfCellInput): PdfCellInput[] => [label, a, b];
  return [
    row("Attacchi vincenti", String(us.attack), String(opp.attack)),
    row("Muri", String(us.block), String(opp.block)),
    row("Ace", String(us.ace), String(opp.ace)),
    row("Errori dell'avversaria", String(pointsFromErrors(us)), String(pointsFromErrors(opp))),
    [{ text: "Punti totali", bold: true }, { text: String(us.points), bold: true }, { text: String(opp.points), bold: true }],
    row("Punti in battuta (break point)", ratio(us.breakPoints, us.served), ratio(opp.breakPoints, opp.served)),
    row("Cambio palla (side-out)", ratio(us.sideOuts, us.received), ratio(opp.sideOuts, opp.received)),
    row("Serie di punti più lunga", String(us.longestRun), String(opp.longestRun)),
  ];
}

export async function buildScoutPdf({ match, scout, set, generatedAt }: ScoutPdfInput): Promise<Uint8Array> {
  const view = deriveScout(scout);
  const played = view.sets.filter((s) => s.rallies.length > 0);
  const selected = set !== null && played.some((s) => s.n === set) ? set : null;
  const stats = computeStats(view, scout.roster, { set: selected });
  const { us, opp } = stats;

  const dateLabel = format(parseISO(match.matchDate.slice(0, 10)), "EEEE d MMMM yyyy", { locale: it });
  const subtitle = [
    `${dateLabel} · ${match.matchDate.slice(11, 16)}`,
    match.location,
    match.category ? CATEGORY_LABELS[match.category] : null,
    selected ? `${selected}° set` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const report = await PdfReport.create({
    title: `Tabellino ${matchTitle(match)}`,
    subtitle,
    documentTitle: `Tabellino ${matchTitle(match)}`,
    footerLabel: "Volley Lignano · scout, riservato allo staff",
    orientation: "landscape",
    generatedAt,
  });

  const over = view.decided || scout.finished;
  report.heading(
    "Risultato",
    over ? "Calcolato con lo scout: non è il risultato ufficiale" : "Partita non ancora conclusa: risultato provvisorio",
  );
  report.text(`Volley Lignano ${view.setsWon.us} – ${view.setsWon.opp} ${match.opponent} (set)`, { size: 13, bold: true, tone: "default", gapAfter: 8 });

  report.table(
    [
      { header: "Set", weight: 1, align: "center" },
      { header: "Punteggio", weight: 1.4, align: "center" },
      { header: "Esito", weight: 1.4, align: "center" },
      { header: "Scambi", weight: 1, align: "center" },
      { header: "Durata stimata", weight: 1.4, align: "center" },
      { header: "Serie più lunga (noi · loro)", weight: 2, align: "center" },
    ],
    stats.sets
      .filter((s) => s.rallies > 0)
      .map((s): PdfCellInput[] => [
        { text: `${s.n}°`, bold: true },
        { text: `${s.score.us}–${s.score.opp}`, bold: true },
        s.closed && s.winner
          ? { text: s.winner === "us" ? "Vinto" : "Perso", tone: s.winner === "us" ? "success" : "danger" }
          : { text: "In corso", tone: "muted" },
        String(s.rallies),
        s.minutes ? minutesText(s.minutes) : dash,
        `${s.longestRun.us} · ${s.longestRun.opp}`,
      ]),
    { zebra: false },
  );

  const teamColumns: PdfColumn[] = [
    { header: "", weight: 3 },
    { header: "Noi", weight: 1.6, align: "center" },
    { header: match.opponent, weight: 1.6, align: "center" },
  ];
  tableSection(report, "Come si è fatto punto", selected ? `${selected}° set` : "tutta la partita", teamColumns, howRows(us, opp));

  const errorRows = ERROR_HOWS.filter((how) => us.committed[how] > 0 || opp.committed[how] > 0).map(
    (how): PdfCellInput[] => [HOW_META[how].label, count(us.committed[how]), count(opp.committed[how])],
  );
  tableSection(
    report,
    "Errori e falli",
    "ogni errore o fallo è un punto per l'altra squadra",
    teamColumns,
    errorRows.length > 0
      ? [...errorRows, [{ text: "Totale", bold: true }, { text: String(us.errors), bold: true }, { text: String(opp.errors), bold: true }]]
      : [],
    "Nessun errore o fallo segnato.",
  );

  report.requireSpace(24 + FLOW_HEIGHT);
  report.heading("Andamento del punteggio", "sopra la linea in vantaggio noi, sotto loro");
  report.canvas(FLOW_HEIGHT, (canvas) => drawFlow(canvas, stats.sets.filter((s) => selected === null || s.n === selected)));

  playerSection(report, "Volley Lignano", "us", stats.players.us);
  playerSection(report, match.opponent, "opp", stats.players.opp);

  report.requireSpace(60);
  report.text(
    "Come leggere: Tot = punti fatti (attacchi vincenti, muri, ace) · BP = punti fatti mentre la propria squadra batteva (break point) · V-P = punti fatti meno " +
      "errori e attacchi murati · Mur = attacchi murati dall'avversaria · Altri = alzate e difese sbagliate e falli fischiati attribuiti a una giocatrice.",
    { size: 7.5, gapAfter: 3 },
  );
  report.text(
    "Lo scout segna come finisce ogni scambio, non ogni tocco: per questo non ci sono attacchi tentati, ricezioni totali e le relative percentuali. " +
      "Le durate dei set sono stimate dall'ora del primo e dell'ultimo punto segnato.",
    { size: 7.5, gapAfter: 0 },
  );

  return report.finish();
}
