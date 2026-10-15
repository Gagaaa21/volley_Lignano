import { clip, endPath, popGraphicsState, pushGraphicsState, rectangle, rgb, type RGB } from "pdf-lib";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { matchTitle } from "@/lib/calendar";
import { CATEGORY_LABELS } from "@/lib/category";
import { PdfReport, type PdfCanvas, type PdfCell, type PdfCellInput, type PdfColumn } from "@/lib/pdf/report";
import { cellText, columnsFor, totalOf, type Column, type Row } from "@/lib/scout/columns";
import { lineupSummary, type StartingLineupRow, type SubstitutionRow } from "@/lib/scout/court";
import { deriveScout } from "@/lib/scout/derive";
import { footnoteFor, legendFor } from "@/lib/scout/legend";
import { effectiveLevel, LEVEL_META } from "@/lib/scout/levels";
import { ERROR_HOWS, HOW_META } from "@/lib/scout/rules";
import {
  computeStats,
  hasActivity,
  percent,
  pointsFromErrors,
  sumDetails,
  zonedTouches,
  type PlayerStats,
  type SetSummary,
  type SideAnalysis,
  type TeamStats,
  type ZoneGrid,
} from "@/lib/scout/stats";
import { TOUCH_SKILLS } from "@/lib/scout/touches";
import { SCOUT_GRADES, type ScoutData, type ScoutGrade, type ScoutLevel } from "@/lib/scout/types";
import type { Match } from "@/lib/types";

/**
 * Il tabellino di una partita in PDF (A4 orizzontale): parziali, come si è
 * fatto punto, errori e falli, andamento del punteggio e una tabella per
 * squadra con i numeri di ogni giocatrice. Coi livelli «Con ricezioni» e
 * «Completo» si aggiungono la ricezione (voti, zone, cambio palla) e, nel
 * Completo, le mappe del campo, le rotazioni e le colonne di battuta, attacco
 * e difesa. Stessi conti e stesse colonne della pagina «Tabellino»
 * (src/lib/scout/stats.ts e columns.ts).
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

function balanceCell(value: number): PdfCell {
  return { text: signed(value), tone: value > 0 ? "success" : value < 0 ? "danger" : "muted" };
}

/** Le colonne del tabellino di una squadra: quelle del livello, uguali a quelle della pagina. */
function playerColumns(level: ScoutLevel): PdfColumn[] {
  const compact = level === "completo";
  return [
    { header: "N°", weight: compact ? 0.6 : 0.55, align: "center" },
    { header: "Giocatrice", weight: compact ? 3.4 : 3.2 },
    ...columnsFor(level).map((column) => ({ header: column.pdf, weight: compact ? 1 : 0.85, align: "center" as const })),
  ];
}

function statCell(column: Column, row: Row, total = false): PdfCellInput {
  const text = cellText(column, row, { ascii: true });
  if (column.kind === "balance") return total ? { text, bold: true } : balanceCell(column.value(row) ?? 0);
  if (column.kind === "pct" || column.kind === "eff") return text === "–" ? dash : { text, bold: total };
  const n = column.value(row) ?? 0;
  if (!total && n === 0 && column.kind !== "strong") return dash;
  return { text, bold: total || column.kind === "strong" };
}

function playerRow(p: PlayerStats, level: ScoutLevel): PdfCellInput[] {
  return [
    { text: p.number ?? "–", bold: true, tone: p.number ? "default" : "muted" },
    { text: p.libero ? `${p.name} (L)` : p.name, bold: true, tone: p.id === "?" ? "muted" : "default" },
    ...columnsFor(level).map((column) => statCell(column, p)),
  ];
}

function totalRow(players: PlayerStats[], level: ScoutLevel): PdfCellInput[] {
  const total = totalOf(players);
  return ["", { text: "Squadra", bold: true }, ...columnsFor(level).map((column) => statCell(column, total, true))];
}

/** Titolo e tabella insieme: se non ci stanno nello spazio rimasto, vanno tutti in una pagina nuova. */
function tableSection(
  report: PdfReport,
  title: string,
  detail: string,
  columns: PdfColumn[],
  rows: PdfCellInput[][],
  emptyText?: string,
  compact = false,
) {
  report.requireSpace(24 + (rows.length > 0 ? report.tableHeight(columns, rows, { compact }) : 30));
  report.heading(title, detail);
  report.table(columns, rows, { keepTogether: true, emptyText, compact });
}

function playerSection(report: PdfReport, title: string, side: "us" | "opp", players: PlayerStats[], level: ScoutLevel) {
  const active = players.filter(hasActivity);
  const idle = players.filter((p) => !hasActivity(p));
  const columns = playerColumns(level);
  const compact = level === "completo";
  const rows = [...active.map((p) => playerRow(p, level)), totalRow(players, level)];
  // Titolo e tabella restano insieme: se non ci stanno nello spazio rimasto, vanno tutti in una pagina nuova.
  report.requireSpace(24 + report.tableHeight(columns, rows, { compact }) + (idle.length > 0 ? 22 : 0));
  report.heading(title);
  report.table(columns, rows, {
    keepTogether: true,
    compact,
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

// ── ricezione, mappe e rotazioni (livelli «Con ricezioni» e «Completo») ──

/** I colori dei voti, gli stessi del sito: sfondo e colore del testo. */
const GRADE_RGB: Record<ScoutGrade, { fill: RGB; ink: RGB }> = {
  "#": { fill: rgb(0x12 / 255, 0x80 / 255, 0x4a / 255), ink: rgb(1, 1, 1) },
  "+": { fill: rgb(0x7a / 255, 0xb6 / 255, 0x48 / 255), ink: rgb(0x10 / 255, 0x21 / 255, 0x0a / 255) },
  "!": { fill: rgb(0xe0 / 255, 0xb8 / 255, 0x3a / 255), ink: rgb(0x2b / 255, 0x22 / 255, 0x04 / 255) },
  "-": { fill: rgb(0xe0 / 255, 0x76 / 255, 0x2c / 255), ink: rgb(0x2b / 255, 0x12 / 255, 0x03 / 255) },
  "/": { fill: rgb(0xc2 / 255, 0x46 / 255, 0x30 / 255), ink: rgb(1, 1, 1) },
  "=": { fill: rgb(0xa8 / 255, 0x1f / 255, 0x2b / 255), ink: rgb(1, 1, 1) },
};

const RECEPTION_NAMES = TOUCH_SKILLS.reception.gradeLabels;
const BAR_HEIGHT = 20;
const BAR_CANVAS_HEIGHT = 56;

/** La barra della ricezione di squadra: un segmento per voto, con il simbolo e quante volte, e sotto la legenda. */
function drawReceptionBar(canvas: PdfCanvas, counts: Record<ScoutGrade, number>) {
  const { page, top, left, width, fonts, colors, safe } = canvas;
  const total = SCOUT_GRADES.reduce((sum, g) => sum + counts[g], 0);
  if (total === 0) return;
  const gap = 1.5;
  const present = SCOUT_GRADES.filter((g) => counts[g] > 0);
  const usable = width - gap * (present.length - 1);
  let x = left;
  for (const g of present) {
    const w = (counts[g] / total) * usable;
    page.drawRectangle({ x, y: top - 4 - BAR_HEIGHT, width: w, height: BAR_HEIGHT, color: GRADE_RGB[g].fill });
    const label = w >= 30 ? `${g} ${counts[g]}` : w >= 11 ? g : "";
    if (label) {
      const size = 8.5;
      const labelWidth = fonts.bold.widthOfTextAtSize(label, size);
      page.drawText(label, { x: x + (w - labelWidth) / 2, y: top - 4 - BAR_HEIGHT / 2 - size * 0.35, size, font: fonts.bold, color: GRADE_RGB[g].ink });
    }
    x += w + gap;
  }
  // La legenda: un quadratino colorato per voto, con il nome, quante volte e la percentuale.
  let lx = left;
  const ly = top - 4 - BAR_HEIGHT - 16;
  for (const g of SCOUT_GRADES) {
    const text = safe(`${g} ${RECEPTION_NAMES[g]} ${counts[g]} (${percent(counts[g], total) ?? 0}%)`);
    const itemWidth = fonts.regular.widthOfTextAtSize(text, 7.5) + 18;
    page.drawRectangle({ x: lx, y: ly, width: 7, height: 7, color: GRADE_RGB[g].fill });
    page.drawText(text, { x: lx + 11, y: ly + 0.5, size: 7.5, font: fonts.regular, color: colors.ink });
    lx += itemWidth + 6;
  }
}

/** Un colore del campo, dal chiaro (pochi tocchi riusciti) allo scuro (molti): il blu della squadra su fondo bianco. */
function zoneTint(good: number, total: number, primary: RGB): { fill: RGB; dark: boolean } {
  if (total === 0) return { fill: rgb(0.94, 0.95, 0.96), dark: false };
  const share = (good / total) * 100;
  const alpha = share < 25 ? 0.12 : share < 40 ? 0.22 : share < 55 ? 0.38 : share < 70 ? 0.58 : 0.8;
  return {
    fill: rgb(1 - (1 - primary.red) * alpha, 1 - (1 - primary.green) * alpha, 1 - (1 - primary.blue) * alpha),
    dark: alpha >= 0.58,
  };
}

interface ZoneMapSpec {
  title: string;
  grid: ZoneGrid;
  /** Cosa conta come riuscito, per la didascalia. */
  good: string;
}

const ZONE_ROWS = [
  [4, 3, 2],
  [5, 6, 1],
];
const ZONE_CELL_H = 30;
const ZONE_CANVAS_HEIGHT = 112;

/** Le mappe del campo affiancate: sei zone ciascuna, con la percentuale di tocchi riusciti e quanti sono. */
function drawZoneMaps(canvas: PdfCanvas, maps: ZoneMapSpec[]) {
  const { page, top, left, width, fonts, colors, safe } = canvas;
  const count = maps.length;
  if (count === 0) return;
  const gap = 24;
  const mapWidth = Math.min(210, (width - gap * (count - 1)) / count);
  maps.forEach((map, index) => {
    const x0 = left + index * (mapWidth + gap);
    const title = safe(map.title);
    page.drawText(title, { x: x0, y: top - 9, size: 8.5, font: fonts.bold, color: colors.ink });
    const net = "RETE";
    page.drawText(net, { x: x0 + (mapWidth - fonts.bold.widthOfTextAtSize(net, 6)) / 2, y: top - 19, size: 6, font: fonts.bold, color: colors.muted });
    const cellW = (mapWidth - 6) / 3;
    ZONE_ROWS.forEach((row, r) => {
      row.forEach((zone, c) => {
        const cell = map.grid[zone];
        const { fill, dark } = zoneTint(cell.good, cell.total, colors.primary);
        const cx = x0 + c * (cellW + 3);
        const cy = top - 24 - (r + 1) * ZONE_CELL_H - r * 3;
        page.drawRectangle({ x: cx, y: cy, width: cellW, height: ZONE_CELL_H, color: fill });
        const ink = dark ? rgb(1, 1, 1) : colors.ink;
        const main = cell.total === 0 ? "-" : `${percent(cell.good, cell.total) ?? 0}%`;
        page.drawText(main, { x: cx + (cellW - fonts.bold.widthOfTextAtSize(main, 10)) / 2, y: cy + 13, size: 10, font: fonts.bold, color: ink });
        const sub = safe(`Zona ${zone}${cell.total ? ` · ${cell.total}` : ""}`);
        page.drawText(sub, { x: cx + (cellW - fonts.regular.widthOfTextAtSize(sub, 6.5)) / 2, y: cy + 4, size: 6.5, font: fonts.regular, color: ink });
      });
    });
    const caption = safe(`% di tocchi ${map.good}`);
    page.drawText(caption, { x: x0, y: top - 24 - 2 * ZONE_CELL_H - 3 - 11, size: 6.5, font: fonts.regular, color: colors.muted });
  });
}

function ratio2(part: number, total: number): string {
  return total === 0 ? "–" : `${part} su ${total} (${percent(part, total)}%)`;
}

function receptionSections(report: PdfReport, matchOpponent: string, analysis: Record<"us" | "opp", SideAnalysis>, players: PlayerStats[], level: ScoutLevel) {
  const us = analysis.us;
  if (us.receptions === 0) return;
  const good = (a: SideAnalysis) => a.reception["#"] + a.reception["+"];
  const sideOuts = (a: SideAnalysis) => SCOUT_GRADES.filter((g) => g !== "=").reduce((n, g) => n + a.sideOutByGrade[g].won, 0);
  const received = (a: SideAnalysis) => SCOUT_GRADES.reduce((n, g) => n + a.sideOutByGrade[g].total, 0);
  const both = level === "completo" && analysis.opp.receptions > 0;
  const cell = (a: SideAnalysis, value: string): PdfCellInput => (a.receptions === 0 ? dash : value);

  tableSection(
    report,
    "La ricezione",
    "com'è andata ogni ricezione, con il voto segnato",
    [
      { header: "", weight: 3 },
      { header: "Noi", weight: 1.6, align: "center" },
      ...(both ? [{ header: matchOpponent, weight: 1.6, align: "center" as const }] : []),
    ],
    [
      ["Ricezioni segnate", String(us.receptions), ...(both ? [String(analysis.opp.receptions)] : [])],
      ["Positive (# e +)", ratio2(good(us), us.receptions), ...(both ? [cell(analysis.opp, ratio2(good(analysis.opp), analysis.opp.receptions))] : [])],
      ["Perfette (#)", ratio2(us.reception["#"], us.receptions), ...(both ? [cell(analysis.opp, ratio2(analysis.opp.reception["#"], analysis.opp.receptions))] : [])],
      ["Errori (=)", ratio2(us.reception["="], us.receptions), ...(both ? [cell(analysis.opp, ratio2(analysis.opp.reception["="], analysis.opp.receptions))] : [])],
      [
        "Cambio palla dopo la ricezione",
        ratio2(sideOuts(us), received(us)),
        ...(both ? [cell(analysis.opp, ratio2(sideOuts(analysis.opp), received(analysis.opp)))] : []),
      ],
    ],
  );

  report.requireSpace(24 + BAR_CANVAS_HEIGHT);
  report.heading("Com'è andata la ricezione della squadra", "# perfetta, + positiva, ! neutra, - negativa, / scarsa, = errore");
  report.canvas(BAR_CANVAS_HEIGHT, (canvas) => drawReceptionBar(canvas, us.reception));

  const receivers = players.filter((p) => p.detail.receptions > 0).sort((a, b) => b.detail.receptions - a.detail.receptions);
  const playerColumns: PdfColumn[] = [
    { header: "N°", weight: 0.55, align: "center" },
    { header: "Giocatrice", weight: 3.2 },
    { header: "Tot", weight: 0.8, align: "center" },
    ...SCOUT_GRADES.map((g) => ({ header: g, weight: 0.7, align: "center" as const })),
    { header: "Pos%", weight: 0.9, align: "center" },
    { header: "Prf%", weight: 0.9, align: "center" },
  ];
  const line = (name: string, number: string, counts: Record<ScoutGrade, number>, bold = false): PdfCellInput[] => {
    const total = SCOUT_GRADES.reduce((n, g) => n + counts[g], 0);
    return [
      { text: number, bold: true },
      { text: name, bold: true },
      { text: String(total), bold },
      ...SCOUT_GRADES.map((g): PdfCellInput => (counts[g] === 0 && !bold ? dash : { text: String(counts[g]), bold })),
      { text: total ? `${percent(counts["#"] + counts["+"], total)}%` : "–", bold },
      { text: total ? `${percent(counts["#"], total)}%` : "–", bold },
    ];
  };
  tableSection(
    report,
    "Ricezione per giocatrice",
    "quante volte per voto",
    playerColumns,
    [...receivers.map((p) => line(p.libero ? `${p.name} (L)` : p.name, p.number ?? "–", p.detail.reception)), line("Squadra", "", sumDetails(receivers).reception, true)],
  );

  const outRows = SCOUT_GRADES.filter((g) => g !== "=" && us.sideOutByGrade[g].total > 0).map(
    (g): PdfCellInput[] => [
      `${g}  ${RECEPTION_NAMES[g]}`,
      String(us.sideOutByGrade[g].total),
      String(us.sideOutByGrade[g].won),
      { text: `${percent(us.sideOutByGrade[g].won, us.sideOutByGrade[g].total) ?? 0}%`, bold: true },
    ],
  );
  if (outRows.length > 0) {
    tableSection(
      report,
      "Il cambio palla dipende dalla ricezione",
      "dopo una ricezione di quel voto, quante volte lo scambio è stato vinto",
      [
        { header: "Voto della ricezione", weight: 3 },
        { header: "Ricezioni", weight: 1.2, align: "center" },
        { header: "Scambi vinti", weight: 1.2, align: "center" },
        { header: "Cambio palla", weight: 1.2, align: "center" },
      ],
      outRows,
    );
  }
}

function zoneSection(report: PdfReport, analysis: SideAnalysis, level: ScoutLevel) {
  const maps: ZoneMapSpec[] = [];
  if (zonedTouches(analysis.zones.reception) > 0) maps.push({ title: "Dove si riceve", grid: analysis.zones.reception, good: "positivi (# e +)" });
  if (level === "completo" && zonedTouches(analysis.zones.dig) > 0) maps.push({ title: "Dove si difende", grid: analysis.zones.dig, good: "positivi (# e +)" });
  if (level === "completo" && zonedTouches(analysis.zones.attack) > 0) maps.push({ title: "Da dove si attacca", grid: analysis.zones.attack, good: "a punto" });
  if (maps.length === 0) return;
  report.requireSpace(24 + ZONE_CANVAS_HEIGHT);
  report.heading("Le mappe del campo", "viste dalla propria metà, rete in alto: davanti 4-3-2, dietro 5-6-1");
  report.canvas(ZONE_CANVAS_HEIGHT, (canvas) => drawZoneMaps(canvas, maps));
}

function rotationSection(report: PdfReport, analysis: Record<"us" | "opp", SideAnalysis>, opponent: string) {
  const columns: PdfColumn[] = [
    { header: "Rotazione", weight: 1.4, align: "center" },
    { header: "Battute", weight: 1, align: "center" },
    { header: "Punti in battuta", weight: 1.4, align: "center" },
    { header: "Break point", weight: 1.2, align: "center" },
    { header: "Ricezioni", weight: 1, align: "center" },
    { header: "Punti in ricezione", weight: 1.4, align: "center" },
    { header: "Cambio palla", weight: 1.2, align: "center" },
  ];
  const rows = (a: SideAnalysis): PdfCellInput[][] =>
    a.rotations.map((r) => [
      { text: `${r.rotation}ª`, bold: true },
      r.served ? String(r.served) : dash,
      r.served ? String(r.breakPoints) : dash,
      r.served ? { text: `${percent(r.breakPoints, r.served)}%`, bold: true } : dash,
      r.received ? String(r.received) : dash,
      r.received ? String(r.sideOuts) : dash,
      r.received ? { text: `${percent(r.sideOuts, r.received)}%`, bold: true } : dash,
    ]);
  const used = (a: SideAnalysis) => a.rotations.some((r) => r.served + r.received > 0);
  if (!used(analysis.us)) return;
  tableSection(report, "Le rotazioni · Volley Lignano", "la 1ª è quella con cui si comincia il set; si ruota quando si recupera la battuta", columns, rows(analysis.us));
  if (used(analysis.opp)) tableSection(report, `Le rotazioni · ${opponent}`, "stesse regole, per l'avversaria", columns, rows(analysis.opp));
}

function lineupSections(report: PdfReport, starts: StartingLineupRow[], subs: SubstitutionRow[], opponent: string) {
  if (starts.length > 0) {
    tableSection(
      report,
      "Formazioni di partenza",
      "chi era in campo all'inizio di ogni set, dalla posizione 1 (in battuta) alla 6",
      [
        { header: "Set", weight: 0.8, align: "center" },
        { header: "Squadra", weight: 2.6 },
        ...[1, 2, 3, 4, 5, 6].map((p): PdfColumn => ({ header: String(p), weight: 0.9, align: "center" })),
        { header: "Libero", weight: 1.1, align: "center" },
      ],
      starts.map((row): PdfCellInput[] => [
        { text: `${row.set}°`, bold: true },
        row.side === "us" ? "Volley Lignano" : opponent,
        ...row.positions.map((label): PdfCellInput => ({ text: label, bold: true })),
        row.libero ? { text: row.libero, bold: true } : dash,
      ]),
    );
  }
  if (subs.length > 0) {
    tableSection(
      report,
      "Cambi",
      "i cambi fatti durante i set",
      [
        { header: "Set", weight: 0.8, align: "center" },
        { header: "Squadra", weight: 2.6 },
        { header: "Posizione", weight: 1.2, align: "center" },
        { header: "Esce", weight: 1, align: "center" },
        { header: "Entra", weight: 1, align: "center" },
        { header: "Punteggio", weight: 1.3, align: "center" },
      ],
      subs.map((sub): PdfCellInput[] => [
        { text: `${sub.set}°`, bold: true },
        sub.side === "us" ? "Volley Lignano" : opponent,
        String(sub.position),
        sub.out,
        { text: sub.in, bold: true },
        `${sub.score.us}-${sub.score.opp}`,
      ]),
    );
  }
}

export async function buildScoutPdf({ match, scout, set, generatedAt }: ScoutPdfInput): Promise<Uint8Array> {
  const view = deriveScout(scout);
  const played = view.sets.filter((s) => s.rallies.length > 0);
  const selected = set !== null && played.some((s) => s.n === set) ? set : null;
  const stats = computeStats(view, scout.roster, { set: selected });
  const { us, opp } = stats;
  const level = effectiveLevel(scout);

  const dateLabel = format(parseISO(match.matchDate.slice(0, 10)), "EEEE d MMMM yyyy", { locale: it });
  const subtitle = [
    `${dateLabel} · ${match.matchDate.slice(11, 16)}`,
    match.location,
    match.category ? CATEGORY_LABELS[match.category] : null,
    selected ? `${selected}° set` : null,
    `Livello ${LEVEL_META[level].label}`,
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
    tag: match.category ? { text: CATEGORY_LABELS[match.category].toUpperCase(), tone: match.category === "U14" ? "u14" : "u15" } : undefined,
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

  if (level !== "base") receptionSections(report, match.opponent, stats.analysis, stats.players.us, level);
  if (level !== "base") zoneSection(report, stats.analysis.us, level);
  if (level === "completo") rotationSection(report, stats.analysis, match.opponent);

  const lineups = lineupSummary(view, scout.roster, selected);
  lineupSections(report, lineups.starts, lineups.subs, match.opponent);

  playerSection(report, "Volley Lignano", "us", stats.players.us, level);
  playerSection(report, match.opponent, "opp", stats.players.opp, level);

  report.requireSpace(60);
  report.text(`Come leggere: ${legendFor(level).map(([term, text]) => `${term} = ${text}`).join("  ·  ")}`, { size: 7.5, gapAfter: 3 });
  report.text(`${footnoteFor(level)} Le durate dei set sono stimate dall'ora del primo tocco o punto e dell'ultimo punto segnato.`, {
    size: 7.5,
    gapAfter: 0,
  });

  return report.finish();
}
