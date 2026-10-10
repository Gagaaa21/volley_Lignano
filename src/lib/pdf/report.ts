import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

/**
 * Base comune dei PDF «da stampare» (calendario partite, riepilogo presenze,
 * test fisici): intestazione col logo, titoli di sezione, tabelle che vanno a
 * capo da sole e continuano sulla pagina dopo (con l'intestazione ripetuta),
 * piè di pagina con numero di pagina.
 *
 * Stessi font del PDF delle formazioni (Liberation Sans, già ridotto al
 * Latin-1 e incorporato solo per i glifi usati): i caratteri che il font non ha
 * vengono sostituiti prima di scrivere (vedi `safeText`), così un nome
 * insolito non rompe mai il documento.
 */

const ASSETS_DIR = path.join(process.cwd(), "src/assets");
const FONTS_DIR = path.join(ASSETS_DIR, "fonts");
const PDF_ASSETS_DIR = path.join(ASSETS_DIR, "pdf");

export type PdfTheme = "u14u15" | "minivolley";
export type PdfTone = "default" | "muted" | "success" | "danger" | "u14" | "u15" | "primary";

interface Palette {
  primary: RGB;
  dark: RGB;
  soft: RGB;
  crest: string;
}

const PALETTES: Record<PdfTheme, Palette> = {
  u14u15: {
    primary: rgb(0x1c / 255, 0x5b / 255, 0xae / 255),
    dark: rgb(0x16 / 255, 0x33 / 255, 0x5c / 255),
    soft: rgb(0xee / 255, 0xf5 / 255, 0xfc / 255),
    crest: "crest-lignano.png",
  },
  minivolley: {
    primary: rgb(0xd3 / 255, 0x41 / 255, 0x17 / 255),
    dark: rgb(0x6b / 255, 0x22 / 255, 0x11 / 255),
    soft: rgb(0xff / 255, 0xf4 / 255, 0xf1 / 255),
    crest: "crest-minivolley.png",
  },
};

const INK = rgb(0x0e / 255, 0x1b / 255, 0x2b / 255);
const MUTED = rgb(0x5a / 255, 0x6a / 255, 0x7b / 255);
const BORDER = rgb(0xe2 / 255, 0xe8 / 255, 0xef / 255);
const ZEBRA = rgb(0xf7 / 255, 0xf9 / 255, 0xfb / 255);
const SUCCESS = rgb(0x15 / 255, 0x80 / 255, 0x3d / 255);
const DANGER = rgb(0xc8 / 255, 0x31 / 255, 0x2b / 255);
const U14 = rgb(0x0f / 255, 0x76 / 255, 0x6e / 255);
const U15 = rgb(0x6d / 255, 0x28 / 255, 0xd9 / 255);
const WHITE = rgb(1, 1, 1);

const A4_W = 595.28;
const A4_H = 841.89;
const MARGIN = 40;
const FOOTER_RESERVE = 34;
/** Righe massime per cella: oltre, il testo si tronca con «…» invece di gonfiare la riga. */
const MAX_CELL_LINES = 8;

const BODY_SIZE = 9;
const SUB_SIZE = 7.5;
const HEADER_SIZE = 8;
const LINE_FACTOR = 1.28;
const CELL_PAD_X = 6;
const CELL_PAD_Y = 4.5;

export interface PdfColumn {
  header: string;
  /** Larghezza relativa: le colonne si dividono lo spazio in proporzione. */
  weight: number;
  align?: "left" | "right" | "center";
}

export interface PdfCell {
  text: string;
  /** Seconda riga, più piccola e grigia (es. i parziali sotto il risultato). */
  sub?: string;
  /** Colore della seconda riga (default grigio), es. verde per un miglioramento. */
  subTone?: PdfTone;
  bold?: boolean;
  tone?: PdfTone;
}

export type PdfCellInput = string | PdfCell;

export interface PdfReportOptions {
  /** Titolo grande in alto, es. «Calendario partite». */
  title: string;
  /** Riga sotto il titolo, es. «Under 14 e Under 15 · stagione 2026/27». */
  subtitle?: string;
  /** Titolo nelle proprietà del file (default: `title`). */
  documentTitle?: string;
  /** Scritta a sinistra nel piè di pagina (default: «Volley Lignano»). */
  footerLabel?: string;
  orientation?: "portrait" | "landscape";
  theme?: PdfTheme;
  /** Data mostrata in alto a destra («Aggiornato al …»); default oggi. */
  generatedAt?: Date;
}

/** Date «gg/mm/aaaa» nell'ora italiana, come tutto il sito. */
function formatItalianDate(date: Date): string {
  return date.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Rome",
  });
}

/** Spezza `text` in righe larghe al massimo `maxWidth`: a capo sugli spazi e
 * sugli a-capo del testo, e dentro una parola solo se da sola non ci sta. */
function wrapLines(font: PDFFont, text: string, maxWidth: number, size: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let current = "";
    const flush = () => {
      if (current) out.push(current);
      current = "";
    };
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
        continue;
      }
      flush();
      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        current = word;
        continue;
      }
      // Parola più larga della cella: la si spezza per caratteri.
      let piece = "";
      for (const char of word) {
        if (piece && font.widthOfTextAtSize(piece + char, size) > maxWidth) {
          out.push(piece);
          piece = "";
        }
        piece += char;
      }
      current = piece;
    }
    flush();
  }
  return out;
}

function limitLines(font: PDFFont, lines: string[], maxWidth: number, size: number, maxLines: number): string[] {
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last.length > 0 && font.widthOfTextAtSize(`${last}…`, size) > maxWidth) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last}…`;
  return kept;
}

function toneColor(tone: PdfTone | undefined, palette: Palette): RGB {
  switch (tone) {
    case "muted":
      return MUTED;
    case "success":
      return SUCCESS;
    case "danger":
      return DANGER;
    case "u14":
      return U14;
    case "u15":
      return U15;
    case "primary":
      return palette.primary;
    default:
      return INK;
  }
}

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

/** Lettere dei nomi dell'Europa dell'est e del nord che non si scompongono in "lettera + accento". */
const TRANSLITERATIONS: Record<string, string> = {
  Đ: "D",
  đ: "d",
  Ł: "L",
  ł: "l",
  Ø: "O",
  ø: "o",
  ß: "ss",
  Æ: "AE",
  æ: "ae",
  Œ: "OE",
  œ: "oe",
  ı: "i",
  İ: "I",
  Ħ: "H",
  ħ: "h",
};

/** Sostituisce i caratteri che il font non ha: prima senza accento (ć → c),
 * poi con «?». Un nome strano non deve mai far fallire il PDF. */
function makeSafeText(fonts: Fonts): (value: string) => string {
  const inBold = new Set(fonts.bold.getCharacterSet());
  const supported = new Set(fonts.regular.getCharacterSet().filter((code) => inBold.has(code)));
  return (value: string) => {
    let out = "";
    for (const char of value.replace(/\r/g, "")) {
      const code = char.codePointAt(0) as number;
      if (char === "\n" || supported.has(code)) {
        out += char;
        continue;
      }
      if (code === 0x2022) {
        out += "·";
        continue;
      }
      const base = TRANSLITERATIONS[char] ?? char.normalize("NFD").replace(/[̀-ͯ]/g, "");
      out += base && [...base].every((c) => supported.has(c.codePointAt(0) as number)) ? base : "?";
    }
    return out;
  };
}

interface PreparedCell {
  lines: string[];
  subLines: string[];
  bold: boolean;
  color: RGB;
  subColor: RGB;
  height: number;
}

export class PdfReport {
  private readonly doc: PDFDocument;
  private readonly fonts: Fonts;
  private readonly crest: PDFImage | null;
  private readonly palette: Palette;
  private readonly safe: (value: string) => string;
  private readonly pageW: number;
  private readonly pageH: number;
  private readonly contentW: number;
  private readonly options: PdfReportOptions;
  private pages: PDFPage[] = [];
  private page!: PDFPage;
  /** Posizione verticale corrente, misurata dal bordo alto della pagina. */
  private cursor = 0;

  private constructor(
    doc: PDFDocument,
    fonts: Fonts,
    crest: PDFImage | null,
    options: PdfReportOptions,
  ) {
    this.doc = doc;
    this.fonts = fonts;
    this.crest = crest;
    this.options = options;
    this.palette = PALETTES[options.theme ?? "u14u15"];
    this.safe = makeSafeText(fonts);
    const landscape = options.orientation === "landscape";
    this.pageW = landscape ? A4_H : A4_W;
    this.pageH = landscape ? A4_W : A4_H;
    this.contentW = this.pageW - MARGIN * 2;
  }

  static async create(options: PdfReportOptions): Promise<PdfReport> {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    doc.setTitle(options.documentTitle ?? options.title);
    doc.setAuthor("Volley Lignano");
    doc.setCreator("Volley Lignano");
    doc.setProducer("Volley Lignano");

    const [regularBytes, boldBytes] = await Promise.all([
      readFile(path.join(FONTS_DIR, "LiberationSans-Regular.ttf")),
      readFile(path.join(FONTS_DIR, "LiberationSans-Bold.ttf")),
    ]);
    const fonts: Fonts = {
      regular: await doc.embedFont(regularBytes, { subset: true }),
      bold: await doc.embedFont(boldBytes, { subset: true }),
    };

    const palette = PALETTES[options.theme ?? "u14u15"];
    const crest = await readFile(path.join(PDF_ASSETS_DIR, palette.crest))
      .then((bytes) => doc.embedPng(bytes))
      .catch(() => null);

    const report = new PdfReport(doc, fonts, crest, options);
    report.addPage(true);
    return report;
  }

  // ── pagine ──────────────────────────────────────────────────────────

  private addPage(first = false) {
    this.page = this.doc.addPage([this.pageW, this.pageH]);
    this.pages.push(this.page);
    this.cursor = MARGIN;
    if (first) this.drawFirstHeader();
    else this.drawRunningHeader();
  }

  private get bottomLimit() {
    return this.pageH - MARGIN - FOOTER_RESERVE;
  }

  private ensureSpace(height: number) {
    if (this.cursor + height > this.bottomLimit) this.addPage();
  }

  private yOf(top: number) {
    return this.pageH - top;
  }

  private drawFirstHeader() {
    const { regular, bold } = this.fonts;
    const crestSize = 46;
    const left = MARGIN + (this.crest ? crestSize + 12 : 0);
    if (this.crest) {
      this.page.drawImage(this.crest, {
        x: MARGIN,
        y: this.yOf(this.cursor + crestSize),
        width: crestSize,
        height: crestSize,
      });
    }
    this.page.drawText(this.safe("Volley Lignano"), {
      x: left,
      y: this.yOf(this.cursor + 11),
      size: 9,
      font: bold,
      color: this.palette.primary,
    });
    this.page.drawText(this.safe(this.options.title), {
      x: left,
      y: this.yOf(this.cursor + 31),
      size: 20,
      font: bold,
      color: INK,
    });
    if (this.options.subtitle) {
      this.page.drawText(this.safe(this.options.subtitle), {
        x: left,
        y: this.yOf(this.cursor + 45),
        size: 9.5,
        font: regular,
        color: MUTED,
      });
    }
    const updated = `Aggiornato al ${formatItalianDate(this.options.generatedAt ?? new Date())}`;
    const updatedWidth = regular.widthOfTextAtSize(updated, 8.5);
    this.page.drawText(updated, {
      x: this.pageW - MARGIN - updatedWidth,
      y: this.yOf(this.cursor + 11),
      size: 8.5,
      font: regular,
      color: MUTED,
    });
    this.cursor += crestSize + 10;
    this.page.drawLine({
      start: { x: MARGIN, y: this.yOf(this.cursor) },
      end: { x: this.pageW - MARGIN, y: this.yOf(this.cursor) },
      thickness: 1.5,
      color: this.palette.primary,
    });
    this.cursor += 18;
  }

  private drawRunningHeader() {
    const { regular, bold } = this.fonts;
    this.page.drawText(this.safe("Volley Lignano"), {
      x: MARGIN,
      y: this.yOf(this.cursor + 8),
      size: 8.5,
      font: bold,
      color: this.palette.primary,
    });
    const label = this.safe(this.options.title);
    const width = regular.widthOfTextAtSize(label, 8.5);
    this.page.drawText(label, {
      x: this.pageW - MARGIN - width,
      y: this.yOf(this.cursor + 8),
      size: 8.5,
      font: regular,
      color: MUTED,
    });
    this.cursor += 15;
    this.page.drawLine({
      start: { x: MARGIN, y: this.yOf(this.cursor) },
      end: { x: this.pageW - MARGIN, y: this.yOf(this.cursor) },
      thickness: 0.75,
      color: BORDER,
    });
    this.cursor += 14;
  }

  // ── contenuto ───────────────────────────────────────────────────────

  /** Titolo di sezione, con un dettaglio a destra (es. «5 partite»). */
  heading(title: string, detail?: string) {
    this.ensureSpace(64);
    const { regular, bold } = this.fonts;
    this.page.drawText(this.safe(title), {
      x: MARGIN,
      y: this.yOf(this.cursor + 12),
      size: 13,
      font: bold,
      color: this.palette.dark,
    });
    if (detail) {
      const text = this.safe(detail);
      const width = regular.widthOfTextAtSize(text, 9);
      this.page.drawText(text, {
        x: this.pageW - MARGIN - width,
        y: this.yOf(this.cursor + 12),
        size: 9,
        font: regular,
        color: MUTED,
      });
    }
    this.cursor += 22;
  }

  /** Paragrafo di testo semplice, a capo da solo. */
  text(value: string, options: { size?: number; tone?: PdfTone; bold?: boolean; gapAfter?: number } = {}) {
    const size = options.size ?? 9;
    const font = options.bold ? this.fonts.bold : this.fonts.regular;
    const lines = wrapLines(font, this.safe(value), this.contentW, size);
    const lineHeight = size * LINE_FACTOR;
    for (const line of lines) {
      this.ensureSpace(lineHeight);
      this.page.drawText(line, {
        x: MARGIN,
        y: this.yOf(this.cursor + size),
        size,
        font,
        color: toneColor(options.tone ?? "muted", this.palette),
      });
      this.cursor += lineHeight;
    }
    this.cursor += options.gapAfter ?? 6;
  }

  spacer(height: number) {
    this.cursor += height;
  }

  private columnWidths(columns: PdfColumn[]): number[] {
    const total = columns.reduce((sum, c) => sum + c.weight, 0);
    return columns.map((c) => (c.weight / total) * this.contentW);
  }

  private prepareCell(cell: PdfCellInput, width: number): PreparedCell {
    const { regular, bold } = this.fonts;
    const input: PdfCell = typeof cell === "string" ? { text: cell } : cell;
    const innerWidth = width - CELL_PAD_X * 2;
    const font = input.bold ? bold : regular;
    const lines = limitLines(
      font,
      wrapLines(font, this.safe(input.text), innerWidth, BODY_SIZE),
      innerWidth,
      BODY_SIZE,
      MAX_CELL_LINES,
    );
    const subLines = input.sub
      ? limitLines(regular, wrapLines(regular, this.safe(input.sub), innerWidth, SUB_SIZE), innerWidth, SUB_SIZE, MAX_CELL_LINES)
      : [];
    const textHeight = Math.max(lines.length, 1) * BODY_SIZE * LINE_FACTOR + subLines.length * SUB_SIZE * LINE_FACTOR;
    return {
      lines,
      subLines,
      bold: Boolean(input.bold),
      color: toneColor(input.tone, this.palette),
      subColor: input.subTone ? toneColor(input.subTone, this.palette) : MUTED,
      height: textHeight + CELL_PAD_Y * 2,
    };
  }

  /** Intestazioni di colonna: a capo se serve, al massimo su tre righe. */
  private headerLines(columns: PdfColumn[], widths: number[]): string[][] {
    const { bold } = this.fonts;
    return columns.map((column, i) => {
      const inner = widths[i] - CELL_PAD_X * 2;
      return limitLines(bold, wrapLines(bold, this.safe(column.header), inner, HEADER_SIZE), inner, HEADER_SIZE, 3);
    });
  }

  private headerHeight(headerLines: string[][]): number {
    return Math.max(...headerLines.map((lines) => lines.length), 1) * HEADER_SIZE * LINE_FACTOR + CELL_PAD_Y * 2 + 2;
  }

  private drawTableHeader(columns: PdfColumn[], widths: number[]) {
    const { bold } = this.fonts;
    const lines = this.headerLines(columns, widths);
    const headerH = this.headerHeight(lines);
    this.page.drawRectangle({
      x: MARGIN,
      y: this.yOf(this.cursor + headerH),
      width: this.contentW,
      height: headerH,
      color: this.palette.primary,
    });
    let x = MARGIN;
    columns.forEach((column, i) => {
      lines[i].forEach((label, lineIndex) => {
        const labelWidth = bold.widthOfTextAtSize(label, HEADER_SIZE);
        const textX =
          column.align === "right"
            ? x + widths[i] - CELL_PAD_X - labelWidth
            : column.align === "center"
              ? x + (widths[i] - labelWidth) / 2
              : x + CELL_PAD_X;
        this.page.drawText(label, {
          x: textX,
          y: this.yOf(this.cursor + CELL_PAD_Y + 1 + HEADER_SIZE + lineIndex * HEADER_SIZE * LINE_FACTOR),
          size: HEADER_SIZE,
          font: bold,
          color: WHITE,
        });
      });
      x += widths[i];
    });
    this.cursor += headerH;
  }

  /** Tabella: l'intestazione si ripete a ogni pagina e una riga non si spezza mai tra due pagine. */
  table(
    columns: PdfColumn[],
    rows: PdfCellInput[][],
    options: { emptyText?: string; zebra?: boolean } = {},
  ) {
    const widths = this.columnWidths(columns);
    const headerH = this.headerHeight(this.headerLines(columns, widths));

    if (rows.length === 0) {
      this.text(options.emptyText ?? "Nessun dato.", { tone: "muted", gapAfter: 12 });
      return;
    }

    const prepared = rows.map((row) => {
      const cells = columns.map((_, i) => this.prepareCell(row[i] ?? "", widths[i]));
      return { cells, height: Math.max(...cells.map((c) => c.height)) };
    });

    this.ensureSpace(headerH + prepared[0].height);
    this.drawTableHeader(columns, widths);

    prepared.forEach((row, rowIndex) => {
      if (this.cursor + row.height > this.bottomLimit) {
        this.addPage();
        this.drawTableHeader(columns, widths);
      }
      const top = this.cursor;
      if (options.zebra !== false && rowIndex % 2 === 1) {
        this.page.drawRectangle({
          x: MARGIN,
          y: this.yOf(top + row.height),
          width: this.contentW,
          height: row.height,
          color: ZEBRA,
        });
      }
      let x = MARGIN;
      row.cells.forEach((cell, i) => {
        const align = columns[i].align ?? "left";
        let lineTop = top + CELL_PAD_Y;
        const drawLine = (text: string, size: number, font: PDFFont, color: RGB) => {
          const width = font.widthOfTextAtSize(text, size);
          const textX =
            align === "right" ? x + widths[i] - CELL_PAD_X - width : align === "center" ? x + (widths[i] - width) / 2 : x + CELL_PAD_X;
          this.page.drawText(text, { x: textX, y: this.yOf(lineTop + size), size, font, color });
          lineTop += size * LINE_FACTOR;
        };
        const mainFont = cell.bold ? this.fonts.bold : this.fonts.regular;
        for (const line of cell.lines) drawLine(line, BODY_SIZE, mainFont, cell.color);
        for (const line of cell.subLines) drawLine(line, SUB_SIZE, this.fonts.regular, cell.subColor);
        x += widths[i];
      });
      this.page.drawLine({
        start: { x: MARGIN, y: this.yOf(top + row.height) },
        end: { x: this.pageW - MARGIN, y: this.yOf(top + row.height) },
        thickness: 0.5,
        color: BORDER,
      });
      this.cursor += row.height;
    });
    this.cursor += 14;
  }

  /** Numero di pagine finora (utile ai test). */
  get pageCount() {
    return this.pages.length;
  }

  /** Chiude il documento: piè di pagina con «Pagina X di Y» su ogni pagina. */
  async finish(): Promise<Uint8Array> {
    const { regular } = this.fonts;
    const label = this.safe(this.options.footerLabel ?? "Volley Lignano");
    const total = this.pages.length;
    this.pages.forEach((page, index) => {
      const y = MARGIN - 4;
      page.drawLine({
        start: { x: MARGIN, y: y + 12 },
        end: { x: this.pageW - MARGIN, y: y + 12 },
        thickness: 0.5,
        color: BORDER,
      });
      page.drawText(label, { x: MARGIN, y, size: 8, font: regular, color: MUTED });
      const pageLabel = `Pagina ${index + 1} di ${total}`;
      const width = regular.widthOfTextAtSize(pageLabel, 8);
      page.drawText(pageLabel, { x: this.pageW - MARGIN - width, y, size: 8, font: regular, color: MUTED });
    });
    return this.doc.save();
  }
}

/** Nome di file sicuro (solo minuscole, numeri e trattini). */
export function pdfFilename(base: string): string {
  const slug = base
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${slug || "documento"}.pdf`;
}

/** Risposta HTTP con il PDF: scaricato come file (`attachment`) o aperto nel browser. */
export function pdfResponse(
  bytes: Uint8Array,
  filename: string,
  options: { cache?: string; disposition?: "attachment" | "inline" } = {},
): Response {
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${options.disposition ?? "attachment"}; filename="${filename}"`,
      "Cache-Control": options.cache ?? "no-store",
    },
  });
}
