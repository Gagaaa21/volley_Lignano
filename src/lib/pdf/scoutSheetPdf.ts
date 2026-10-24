import { rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { CATEGORY_LABELS } from "@/lib/category";
import type { PdfReport } from "@/lib/pdf/report";
import { LEVEL_META } from "@/lib/scout/levels";
import { perPoint, seasonOf, type AttackSplit, type ScoutSheet, type SheetSetMark, type SheetTeam } from "@/lib/scout/sheet";
import {
  POINTS_WON,
  SHEET_COLUMNS,
  SHEET_LEGEND,
  SHEET_MARKS,
  sheetBalance,
  sheetCount,
  sheetFootnote,
  sheetGroups,
  sheetMinutes,
  sheetScore,
} from "@/lib/scout/sheetFormat";
import { percent } from "@/lib/scout/stats";
import type { Match } from "@/lib/types";

/**
 * La prima pagina del PDF dello scout: il tabellino come quelli delle leghe, su un A4 verticale (intestazione con le squadre e i
 * set, dati della partita e set con durata, parziali e finali, una tabella per squadra, rotazioni, ricezioni e battute per punto,
 * cambio palla diretto e contrattacco, legenda). Stessi numeri e stesse colonne della pagina (src/lib/scout/sheet.ts e
 * sheetFormat.ts). Se le rose sono così lunghe da non starci, continua su una seconda pagina.
 */

const US_NAME = "Volley Lignano";
const LINE = rgb(0.55, 0.58, 0.62);
const RULE = rgb(0.82, 0.84, 0.87);
const FILL = rgb(0.93, 0.94, 0.95);

interface Ctx {
  page: PDFPage;
  regular: PDFFont;
  bold: PDFFont;
  ink: RGB;
  muted: RGB;
  primary: RGB;
  safe: (value: string) => string;
}

type Align = "left" | "center" | "right";

/** Un testo che non esce dalla sua larghezza (se serve si accorcia con i puntini). */
function text(c: Ctx, value: string, x: number, y: number, width: number, size: number, options: { bold?: boolean; align?: Align; color?: RGB } = {}) {
  const font = options.bold ? c.bold : c.regular;
  let out = c.safe(value);
  if (font.widthOfTextAtSize(out, size) > width) {
    while (out.length > 1 && font.widthOfTextAtSize(`${out}…`, size) > width) out = out.slice(0, -1);
    out = `${out}…`;
  }
  const w = font.widthOfTextAtSize(out, size);
  const dx = options.align === "center" ? (width - w) / 2 : options.align === "right" ? width - w : 0;
  c.page.drawText(out, { x: x + dx, y, size, font, color: options.color ?? c.ink });
}

function box(c: Ctx, x: number, top: number, width: number, height: number, options: { thickness?: number; color?: RGB; fill?: RGB } = {}) {
  c.page.drawRectangle({
    x,
    y: top - height,
    width,
    height,
    borderColor: options.color ?? c.ink,
    borderWidth: options.thickness ?? 0.6,
    color: options.fill,
  });
}

function hline(c: Ctx, x1: number, x2: number, y: number, thickness = 0.4, color: RGB = RULE) {
  c.page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color });
}

function vline(c: Ctx, x: number, top: number, bottom: number, thickness = 0.4, color: RGB = RULE) {
  c.page.drawLine({ start: { x, y: top }, end: { x, y: bottom }, thickness, color });
}

/** A capo sugli spazi, per righe larghe al massimo `width`. */
function wrap(font: PDFFont, value: string, width: number, size: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of value.split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width || !current) current = candidate;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ── misure ───────────────────────────────────────────────────────────

const GROUP_ROW = 9;
const LABEL_ROW = 8.5;
const TOTAL_ROW = 10;
const WON_HEAD = 8;
const SET_ROW = 8.2;
const NUMBER_W = 19;
const NAME_W = 92;

function tableHeight(team: SheetTeam, rowH: number): number {
  return GROUP_ROW + LABEL_ROW + team.lines.length * rowH + TOTAL_ROW + WON_HEAD + team.perSet.length * SET_ROW + 3;
}

// ── blocchi ──────────────────────────────────────────────────────────

function drawHeader(c: Ctx, sheet: ScoutSheet, match: Match, over: boolean, left: number, top: number, width: number): number {
  const category = match.category ? CATEGORY_LABELS[match.category] : "Settore giovanile";
  const competition = match.isTournament ? "Torneo" : match.isFriendly ? "Amichevole" : "Campionato";
  const half = width * 0.47;
  text(c, `${category} Femminile ${seasonOf(match.matchDate)}`, left, top - 12, half, 12.5, { bold: true });
  text(c, competition, left, top - 24, half, 9.5, { color: c.muted });
  hline(c, left, left + half - 10, top - 29, 0.7, c.ink);
  text(c, "Tabellino", left, top - 42, half, 12, { bold: true });
  text(c, over ? "Risultato dello scout (non ufficiale)" : "Partita in corso: risultato provvisorio", left, top - 52, half, 7, { color: c.muted });

  const bx = left + width * 0.5;
  const bw = width * 0.5;
  box(c, bx, top - 2, bw, 40, { thickness: 1.2 });
  for (const [i, row] of [
    { name: US_NAME, sets: sheet.setsWon.us },
    { name: match.opponent, sets: sheet.setsWon.opp },
  ].entries()) {
    const y = top - 17 - i * 16;
    text(c, row.name.toUpperCase(), bx + 8, y, bw - 40, 10.5, { bold: true });
    text(c, String(row.sets), bx + bw - 30, y, 22, 12, { bold: true, align: "right" });
  }
  return 58;
}

function drawInfoAndSets(c: Ctx, sheet: ScoutSheet, match: Match, left: number, top: number, width: number): number {
  const rowH = 9.5;
  const date = format(parseISO(match.matchDate.slice(0, 10)), "dd/MM/yyyy", { locale: it });
  const info: [string, string][] = [
    ["Data", date],
    ["Orario", match.matchDate.slice(11, 16)],
    ["Impianto", match.location],
    ["Gara", `${match.isTournament ? "Torneo" : match.isFriendly ? "Amichevole" : "Campionato"} · ${match.isHome ? "in casa" : "in trasferta"}`],
    ["Scout", `livello ${LEVEL_META[sheet.level].label}`],
  ];
  const setRows = Math.max(sheet.sets.length, 1);
  const height = Math.max(info.length * rowH + 8, (setRows + 2) * rowH + 6);

  const iw = width * 0.47;
  box(c, left, top, iw, height);
  info.forEach(([term, value], i) => {
    const y = top - 10 - i * rowH;
    text(c, term, left + 6, y, 46, 7.5, { bold: true });
    text(c, value, left + 52, y, iw - 58, 7.5);
  });

  const sx = left + width * 0.5;
  const sw = width * 0.5;
  box(c, sx, top, sw, height);
  const cols = [
    { label: "Set", w: 0.1, align: "center" as const },
    { label: "Durata", w: 0.17, align: "center" as const },
    { label: "Punteggi parziali", w: 0.5, align: "center" as const },
    { label: "Finali", w: 0.23, align: "center" as const },
  ];
  const xs: number[] = [];
  let x = sx;
  for (const col of cols) {
    xs.push(x);
    x += col.w * sw;
  }
  c.page.drawRectangle({ x: sx, y: top - rowH - 1, width: sw, height: rowH + 1, color: FILL });
  cols.forEach((col, i) => text(c, col.label, xs[i], top - 7.5, col.w * sw, 6.5, { bold: true, align: col.align }));
  hline(c, sx, sx + sw, top - rowH - 1, 0.6, c.ink);
  sheet.sets.forEach((set, r) => {
    const y = top - rowH - 8.5 - r * rowH;
    text(c, String(set.n), xs[0], y, cols[0].w * sw, 7.5, { bold: true, align: "center" });
    text(c, sheetMinutes(set.minutes), xs[1], y, cols[1].w * sw, 7.5, { align: "center" });
    text(c, set.partials.map(sheetScore).join("   ") || "–", xs[2], y, cols[2].w * sw, 7.5, { align: "center" });
    text(c, `${sheetScore(set.final)}${set.closed ? "" : " *"}`, xs[3], y, cols[3].w * sw, 8, { bold: true, align: "center" });
  });
  for (let i = 1; i < xs.length; i++) vline(c, xs[i], top, top - height, 0.4, LINE);
  const ty = top - height + 3;
  hline(c, sx, sx + sw, ty + rowH - 1.5, 0.6, c.ink);
  text(c, sheetMinutes(sheet.totalMinutes), xs[1], ty + 1, cols[1].w * sw, 7.5, { bold: true, align: "center" });
  text(c, sheetScore(sheet.totalPoints), xs[3], ty + 1, cols[3].w * sw, 7.5, { bold: true, align: "center" });
  if (sheet.sets.some((set) => !set.closed)) text(c, "* in corso", xs[2], ty + 1, cols[2].w * sw, 6, { color: c.muted, align: "center" });
  return height;
}

function drawSetMark(c: Ctx, mark: SheetSetMark, x: number, y: number) {
  if (mark === null) return;
  if (mark === "in") {
    c.page.drawRectangle({ x: x + 0.5, y: y + 1.2, width: 6, height: 3, borderColor: c.ink, borderWidth: 0.5 });
    return;
  }
  c.page.drawRectangle({ x, y: y - 0.6, width: 7, height: 7, borderColor: c.ink, borderWidth: 0.55 });
  text(c, String(mark), x, y + 0.9, 7, 5.5, { bold: true, align: "center" });
}

function drawTeam(c: Ctx, team: SheetTeam, name: string, sets: number, rowH: number, left: number, top: number, width: number): number {
  const setW = Math.max(24, sets * 8 + 4);
  const numericW = (width - NUMBER_W - NAME_W - setW) / SHEET_COLUMNS.length;
  const colX = (i: number) => left + NUMBER_W + NAME_W + setW + i * numericW;
  const height = tableHeight(team, rowH);
  const size = rowH >= 9 ? 7 : 6.3;

  // Intestazione: nome della squadra, «Set» con i numeri (cerchiati se ha battuto per prima), gruppi e colonne.
  c.page.drawRectangle({ x: left, y: top - GROUP_ROW - LABEL_ROW, width, height: GROUP_ROW + LABEL_ROW, color: FILL });
  text(c, name.toUpperCase(), left + 4, top - GROUP_ROW - 5.5, NUMBER_W + NAME_W - 6, 9, { bold: true });
  text(c, "Set", left + NUMBER_W + NAME_W, top - 7, setW, 6.3, { bold: true, align: "center" });
  for (let n = 1; n <= sets; n++) {
    const cx = left + NUMBER_W + NAME_W + (setW - sets * 8) / 2 + (n - 1) * 8 + 4;
    const cy = top - GROUP_ROW - 4.6;
    if (team.firstServes.includes(n)) c.page.drawCircle({ x: cx, y: cy + 1.8, size: 3.4, borderColor: c.ink, borderWidth: 0.5 });
    text(c, String(n), cx - 3, cy, 6, 5.5, { bold: true, align: "center" });
  }
  let index = 0;
  for (const group of sheetGroups()) {
    text(c, group.name, colX(index), top - 7, group.span * numericW, 6.5, { bold: true, align: "center" });
    vline(c, colX(index), top, top - height, 0.5, LINE);
    index += group.span;
  }
  SHEET_COLUMNS.forEach((column, i) => text(c, column.label, colX(i), top - GROUP_ROW - 6.3, numericW, 5.6, { bold: true, align: "center", color: c.muted }));
  hline(c, left, left + width, top - GROUP_ROW - LABEL_ROW, 0.6, c.ink);

  // Le giocatrici.
  let y = top - GROUP_ROW - LABEL_ROW;
  for (const line of team.lines) {
    const base = y - rowH + (rowH - size) / 2 + 0.8;
    const tone = line.active ? c.ink : c.muted;
    text(c, `${line.number ?? "–"}${line.libero ? " L" : ""}`, left + 4, base, NUMBER_W - 4, size, { bold: true, color: tone });
    text(c, line.name, left + NUMBER_W, base, NAME_W - 3, size, { bold: line.active, color: tone });
    line.sets.forEach((mark, i) => drawSetMark(c, mark, left + NUMBER_W + NAME_W + (setW - sets * 8) / 2 + i * 8 + 0.5, base));
    SHEET_COLUMNS.forEach((column, i) => text(c, column.text(line, team), colX(i), base, numericW, size, { bold: column.strong && line.active, align: "center", color: tone }));
    y -= rowH;
    hline(c, left, left + width, y);
  }

  // Il totale.
  hline(c, left, left + width, y, 0.8, c.ink);
  c.page.drawRectangle({ x: left, y: y - TOTAL_ROW, width, height: TOTAL_ROW, color: FILL });
  text(c, "Totali giocatrici", left + 4, y - 7.3, NUMBER_W + NAME_W + setW - 6, 7, { bold: true });
  SHEET_COLUMNS.forEach((column, i) => text(c, column.text(team.total, team), colX(i), y - 7.3, numericW, 7, { bold: true, align: "center" }));
  y -= TOTAL_ROW;
  hline(c, left, left + width, y, 0.6, c.ink);

  // I punti vinti set per set.
  text(c, "Punti vinti", left + 4, y - 6, NUMBER_W + NAME_W - 6, 6, { bold: true, color: c.muted });
  const wonX = (i: number) => (i === 0 ? left + NUMBER_W + NAME_W : colX(i - 1));
  const wonW = (i: number) => (i === 0 ? setW : numericW);
  POINTS_WON.forEach((item, i) => text(c, item.label, wonX(i), y - 6, wonW(i), 5.8, { bold: true, align: "center", color: c.muted }));
  y -= WON_HEAD;
  const rest = SHEET_COLUMNS.slice(3);
  for (const row of team.perSet) {
    const base = y - SET_ROW + 1.9;
    text(c, `Set ${row.n}`, left + NUMBER_W, base, NAME_W - 4, 6.3, { align: "right", color: c.muted });
    POINTS_WON.forEach((item, i) => text(c, sheetCount(row.won[item.key]), wonX(i), base, wonW(i), 6.3, { align: "center" }));
    rest.forEach((column, i) => text(c, column.text(row, team), colX(i + 3), base, numericW, 6.3, { align: "center" }));
    y -= SET_ROW;
  }

  box(c, left, top, width, height, { thickness: 0.8 });
  return height;
}

function drawTeamSummary(c: Ctx, team: SheetTeam, name: string, left: number, top: number, width: number, height: number) {
  box(c, left, top, width, height);
  text(c, name.toUpperCase(), left + 5, top - 10, width - 10, 7.5, { bold: true });
  hline(c, left, left + width, top - 13, 0.5, LINE);
  text(c, "Rot.", left + 5, top - 22, 18, 6, { bold: true, color: c.muted });
  text(c, "Diff", left + 23, top - 22, 18, 6, { bold: true, color: c.muted, align: "center" });
  team.rotations.forEach((row, i) => {
    const y = top - 31 - i * 9;
    text(c, `${row.rotation}ª`, left + 5, y, 18, 7, { bold: true });
    text(c, sheetBalance(row.won - row.lost), left + 23, y, 18, 7, { align: "center" });
  });
  const rx = left + 48;
  const rw = width - 53;
  const perReception = perPoint(team.receptionsFaced, team.sideOutPoints);
  const perServe = perPoint(team.serves, team.breakPoints);
  text(c, `Ricezioni ${team.receptionsFaced}`, rx, top - 23, rw, 7.5, { bold: true });
  text(c, `Punti CP ${team.sideOutPoints}`, rx, top - 32, rw, 7.5, { bold: true });
  if (perReception) text(c, `ogni ${perReception} ricezioni 1 punto`, rx, top - 41, rw, 6.3, { color: c.muted });
  text(c, `Battute ${team.serves}`, rx, top - 56, rw, 7.5, { bold: true });
  text(c, `Punti BP ${team.breakPoints}`, rx, top - 65, rw, 7.5, { bold: true });
  if (perServe) text(c, `ogni ${perServe} battute 1 break point`, rx, top - 74, rw, 6.3, { color: c.muted });
}

function splitTexts(split: AttackSplit): string[] {
  return [sheetCount(split.errors), sheetCount(split.blocked), split.total ? `${percent(split.kills, split.total)}%` : ".", sheetCount(split.total)];
}

function drawMiddle(c: Ctx, sheet: ScoutSheet, opponent: string, left: number, top: number, width: number, height: number) {
  box(c, left, top, width, height);
  const us = sheet.us.attackPhases;
  const opp = sheet.opp.attackPhases;
  if (us && opp) {
    const cell = (width - 10) / 8;
    const labels = ["Err", "Mur", "Punti%", "Tot"];
    let y = top - 9;
    text(c, US_NAME.toUpperCase(), left + 4, y, width / 2 - 8, 6, { bold: true });
    text(c, opponent.toUpperCase(), left + width / 2 + 4, y, width / 2 - 8, 6, { bold: true, align: "right" });
    const section = (title: string, rows: { label: string | null; key: "positive" | "negative" | "counter" }[]) => {
      y -= 4;
      c.page.drawRectangle({ x: left, y: y - 8.5, width, height: 9.5, color: FILL });
      text(c, title, left, y - 6, width, 6.8, { bold: true, align: "center" });
      y -= 9.5;
      for (const row of rows) {
        if (row.label) {
          text(c, row.label, left, y - 6.5, width, 6, { align: "center", color: c.muted });
          y -= 8;
        }
        labels.forEach((label, i) => text(c, label, left + 4 + i * cell, y - 5.5, cell, 5.3, { bold: true, align: "center", color: c.muted }));
        [...labels].reverse().forEach((label, i) => text(c, label, left + 6 + (i + 4) * cell, y - 5.5, cell, 5.3, { bold: true, align: "center", color: c.muted }));
        y -= 6.5;
        splitTexts(us[row.key]).forEach((value, i) => text(c, value, left + 4 + i * cell, y - 6, cell, 6.8, { bold: i === 2, align: "center" }));
        splitTexts(opp[row.key])
          .reverse()
          .forEach((value, i) => text(c, value, left + 6 + (i + 4) * cell, y - 6, cell, 6.8, { bold: i === 1, align: "center" }));
        vline(c, left + width / 2 + 1, y + 6.5, y - 7.5, 0.4, LINE);
        y -= 8;
      }
    };
    section("CAMBIO PALLA DIRETTO", [
      { label: "1° attacco dopo ricezione positiva (# +)", key: "positive" },
      { label: "1° attacco dopo ricezione negativa (! - /)", key: "negative" },
    ]);
    section("CONTRATTACCO", [{ label: null, key: "counter" }]);
    return;
  }
  const byReception = sheet.us.sideOutByReception;
  if (byReception) {
    text(c, `CAMBIO PALLA DOPO LA RICEZIONE · ${US_NAME.toUpperCase()}`, left, top - 11, width, 6.8, { bold: true, align: "center" });
    [
      { label: "Ricezione positiva (# +)", cell: byReception.positive },
      { label: "Ricezione negativa (! - /)", cell: byReception.negative },
    ].forEach(({ label, cell }, i) => {
      const y = top - 28 - i * 13;
      text(c, label, left + 8, y, width * 0.55, 7.5, { color: c.muted });
      text(c, cell.total ? `${cell.won} su ${cell.total} (${percent(cell.won, cell.total)}%)` : ".", left + width * 0.55, y, width * 0.45 - 8, 7.5, { bold: true, align: "right" });
    });
    const note = wrap(c.regular, "Primo attacco dopo la ricezione e contrattacco si contano a livello Completo.", width - 16, 6.3);
    note.forEach((line, i) => text(c, line, left + 8, top - 64 - i * 8, width - 16, 6.3, { color: c.muted }));
    return;
  }
  const note = wrap(
    c.regular,
    c.safe("Il cambio palla diretto (il primo attacco dopo la ricezione) e il contrattacco si contano a livello Completo; il cambio palla dopo la ricezione da «Con ricezioni»."),
    width - 16,
    7,
  );
  note.forEach((line, i) => text(c, line, left + 8, top - 24 - i * 9, width - 16, 7, { color: c.muted }));
}

function legendLines(c: Ctx, sheet: ScoutSheet, width: number): { bold: boolean; text: string }[] {
  const legend = [...SHEET_LEGEND, ...SHEET_MARKS].map(([term, value]) => `${term} ${value}`).join("   ·   ");
  return [
    ...wrap(c.regular, c.safe(legend), width, 6).map((line) => ({ bold: false, text: line })),
    ...wrap(c.regular, c.safe(sheetFootnote(sheet.level)), width, 6).map((line) => ({ bold: false, text: line })),
  ];
}

/** Disegna il tabellino in una o due pagine verticali all'inizio del documento. */
export function addSheetPages(report: PdfReport, sheet: ScoutSheet, match: Match, over: boolean) {
  const SUMMARY_H = 100;
  const gap = 7;
  let pageIndex = 0;

  // Le misure, uguali per tutte le pagine (A4 verticale).
  const plan: { height: (c: Ctx, width: number) => number; draw: (c: Ctx, left: number, top: number, width: number) => void }[] = [];
  const rowFor = (available: number) => {
    const lines = sheet.us.lines.length + sheet.opp.lines.length;
    const fixed = tableHeight({ ...sheet.us, lines: [] }, 0) + tableHeight({ ...sheet.opp, lines: [] }, 0);
    return Math.max(7.2, Math.min(11, (available - fixed) / Math.max(lines, 1)));
  };
  let rowH = 9;
  plan.push({ height: () => 58, draw: (c, left, top, width) => drawHeader(c, sheet, match, over, left, top, width) });
  plan.push({
    height: () => Math.max(5 * 9.5 + 8, (Math.max(sheet.sets.length, 1) + 2) * 9.5 + 6),
    draw: (c, left, top, width) => drawInfoAndSets(c, sheet, match, left, top, width),
  });
  plan.push({ height: () => tableHeight(sheet.us, rowH), draw: (c, left, top, width) => drawTeam(c, sheet.us, US_NAME, sheet.sets.length, rowH, left, top, width) });
  plan.push({ height: () => tableHeight(sheet.opp, rowH), draw: (c, left, top, width) => drawTeam(c, sheet.opp, match.opponent, sheet.sets.length, rowH, left, top, width) });
  plan.push({
    height: () => SUMMARY_H,
    draw: (c, left, top, width) => {
      const side = width * 0.3;
      const middle = width - side * 2 - 8;
      drawTeamSummary(c, sheet.us, US_NAME, left, top, side, SUMMARY_H);
      drawMiddle(c, sheet, match.opponent, left + side + 4, top, middle, SUMMARY_H);
      drawTeamSummary(c, sheet.opp, match.opponent, left + side + middle + 8, top, side, SUMMARY_H);
    },
  });
  plan.push({
    height: (c, width) => legendLines(c, sheet, width).length * 7.5 + 2,
    draw: (c, left, top, width) => legendLines(c, sheet, width).forEach((line, i) => text(c, line.text, left, top - 6 - i * 7.5, width, 6, { color: c.muted })),
  });

  // Una prima passata solo per misurare (serve il contesto dei caratteri), poi il disegno pagina per pagina.
  report.drawnPage("portrait", (first) => {
    const ctx = (page: PDFPage): Ctx => ({ page, regular: first.fonts.regular, bold: first.fonts.bold, ink: first.colors.ink, muted: first.colors.muted, primary: first.colors.primary, safe: first.safe });
    const left = first.margin - 12;
    const width = first.width - left * 2;
    const topStart = first.height - first.margin + 14;
    const capacity = topStart - first.bottom;
    const c0 = ctx(first.page);
    const others = plan.filter((_, i) => i !== 2 && i !== 3).reduce((sum, block) => sum + block.height(c0, width) + gap, 0);
    rowH = rowFor(capacity - others - gap * 2);

    let page = first;
    let top = topStart;
    for (const block of plan) {
      const h = block.height(ctx(page.page), width);
      if (top - h < page.bottom && top !== topStart) {
        pageIndex += 1;
        report.drawnPage("portrait", (next) => (page = next), pageIndex);
        top = topStart;
        text(ctx(page.page), `Tabellino · ${US_NAME} - ${match.opponent} (continua)`, left, top - 9, width, 8, { bold: true });
        top -= 16;
      }
      block.draw(ctx(page.page), left, top, width);
      top -= h + gap;
    }
  }, 0);
}

