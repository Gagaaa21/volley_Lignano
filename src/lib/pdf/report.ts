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
/** Il colore della squadra avversaria nei grafici (la «sabbia» del sito). */
const ACCENT = rgb(0xe2 / 255, 0xa8 / 255, 0x42 / 255);

const A4_W = 595.28;
const A4_H = 841.89;
const MARGIN = 40;
const FOOTER_RESERVE = 34;
/** Spazio che l'intestazione ripetuta occupa in cima a ogni pagina dopo la prima (vedi drawRunningHeader). */
const RUNNING_HEADER_HEIGHT = 29;
/** Righe massime per cella: oltre, il testo si tronca con «…» invece di gonfiare la riga. */
const MAX_CELL_LINES = 8;
/** Larghezza della barra colorata sul bordo di una riga (vedi PdfCell.bar). */
const BAR_WIDTH = 3;
/** Margine del riquadro pieno attorno a un testo (vedi PdfCell.pill). */
const PILL_PAD_X = 3.5;

const BODY_SIZE = 9;
const SUB_SIZE = 7.5;
const HEADER_SIZE = 8;
const LINE_FACTOR = 1.28;
const CELL_PAD_X = 6;
const CELL_PAD_Y = 4.5;

/** Misure di una tabella: caratteri e margini delle celle. Quella compatta serve ai tabellini con molte colonne. */
interface TableMetrics {
  body: number;
  sub: number;
  header: number;
  padX: number;
  padY: number;
}
const TABLE_NORMAL: TableMetrics = { body: BODY_SIZE, sub: SUB_SIZE, header: HEADER_SIZE, padX: CELL_PAD_X, padY: CELL_PAD_Y };
const TABLE_COMPACT: TableMetrics = { body: 7.5, sub: 6.5, header: 6.5, padX: 2.5, padY: 3.5 };
export interface PdfTableOptions {
  emptyText?: string;
  zebra?: boolean;
  keepTogether?: boolean;
  /** Caratteri e margini più piccoli, per le tabelle con tante colonne. */
  compact?: boolean;
}
/** Un paragrafo di queste righe o meno non si spezza tra due pagine; uno più lungo sì, ma con almeno due righe per parte. */
const KEEP_LINES = 5;

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
  /** Il testo su un riquadro pieno del colore di `tone`, scritto in bianco: per un'etichetta corta come «U14». */
  pill?: boolean;
  /** Una barra verticale di questo colore sul bordo sinistro della cella, alta quanto la riga (la categoria di una partita). */
  bar?: PdfTone;
}

export type PdfCellInput = string | PdfCell;

/**
 * Un'area libera della pagina per un disegno (es. un grafico). Le coordinate
 * sono quelle del PDF: l'origine è in basso a sinistra e `y` cresce verso l'alto,
 * quindi l'area occupa da `top` a `top - height`.
 */
export interface PdfCanvas {
  page: PDFPage;
  fonts: { regular: PDFFont; bold: PDFFont };
  colors: { ink: RGB; muted: RGB; border: RGB; primary: RGB; dark: RGB; soft: RGB; accent: RGB };
  left: number;
  top: number;
  width: number;
  height: number;
  /** Come per ogni testo del documento: sostituisce i caratteri che il font non ha. */
  safe: (value: string) => string;
}

/** Un tipo di riquadro evidenziato nel testo (consiglio, attenzione, esempio, informazione). */
export type PdfCalloutKind = "tip" | "warning" | "example" | "info";

export interface PdfImageOptions {
  /** Didascalia sotto l'immagine. */
  caption?: string;
  /** Larghezza massima in punti (default: tutta la larghezza utile). */
  maxWidth?: number;
  /** Altezza massima in punti (default: poco più di metà pagina). */
  maxHeight?: number;
  /** Legenda dei marcatori numerati: sta sempre nella stessa pagina dell'immagine. */
  legend?: string[];
}

/** Come si dispone una legenda di marcatori numerati (vedi `layoutLegend`). */
interface LegendLayout {
  items: string[];
  size: number;
  columns: number;
  gap: number;
  columnWidth: number;
  textIndent: number;
  perColumn: number;
  heights: number[];
  height: number;
}

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
  /** Un'etichetta piena accanto a «Volley Lignano», in ogni intestazione (la categoria del documento, es. «UNDER 14»). */
  tag?: { text: string; tone: PdfTone };
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

/** Un pezzo di riga: il testo e se è in grassetto. */
interface Run {
  text: string;
  bold: boolean;
}

/** «**grassetto**» dentro una frase: restituisce i pezzi in ordine, alternando normale e grassetto. */
function parseRuns(value: string): Run[] {
  return value
    .split("**")
    .map((text, i) => ({ text, bold: i % 2 === 1 }))
    .filter((run) => run.text !== "");
}

/** Spezza una frase con grassetti in righe larghe al massimo `maxWidth` (a capo sugli spazi e sugli a-capo del testo). */
function wrapRuns(fonts: Fonts, runs: Run[], maxWidth: number, size: number): Run[][] {
  const widthOf = (text: string, bold: boolean) => (bold ? fonts.bold : fonts.regular).widthOfTextAtSize(text, size);
  const lines: Run[][] = [];
  let line: Run[] = [];
  let lineWidth = 0;
  const push = (text: string, bold: boolean) => {
    const last = line[line.length - 1];
    if (last && last.bold === bold) last.text += text;
    else line.push({ text, bold });
    lineWidth += widthOf(text, bold);
  };
  const flush = () => {
    // Gli spazi in fondo non si disegnano.
    const last = line[line.length - 1];
    if (last) last.text = last.text.replace(/\s+$/, "");
    lines.push(line);
    line = [];
    lineWidth = 0;
  };

  for (const run of runs) {
    run.text.split("\n").forEach((paragraph, paragraphIndex) => {
      if (paragraphIndex > 0) flush();
      for (const token of paragraph.split(/(\s+)/).filter((t) => t !== "")) {
        const isSpace = /^\s+$/.test(token);
        if (isSpace) {
          if (line.length > 0) push(" ", run.bold);
          continue;
        }
        const tokenWidth = widthOf(token, run.bold);
        if (lineWidth + tokenWidth > maxWidth && line.length > 0) flush();
        if (tokenWidth <= maxWidth) {
          push(token, run.bold);
          continue;
        }
        // Parola più larga della riga: la si spezza per caratteri.
        let piece = "";
        for (const char of token) {
          if (piece && widthOf(piece + char, run.bold) > maxWidth - lineWidth) {
            push(piece, run.bold);
            flush();
            piece = "";
          }
          piece += char;
        }
        if (piece) push(piece, run.bold);
      }
    });
  }
  if (line.length > 0) flush();
  return lines;
}

interface CalloutStyle {
  bar: RGB;
  background: RGB;
  label: string;
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
  pill: boolean;
  bar: RGB | null;
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
  private readonly embeddedImages = new WeakMap<Uint8Array, Promise<PDFImage>>();
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

  /** Va a una pagina nuova se non restano `height` punti; dice se l'ha fatto. */
  private ensureSpace(height: number): boolean {
    if (this.cursor + height <= this.bottomLimit) return false;
    this.addPage();
    return true;
  }

  /** Altezza utile di una pagina intera (sotto l'intestazione ripetuta). */
  private get pageCapacity() {
    return this.bottomLimit - (MARGIN + RUNNING_HEADER_HEIGHT);
  }

  private yOf(top: number) {
    return this.pageH - top;
  }

  /** L'etichetta piena (`options.tag`) subito dopo «Volley Lignano», con la stessa base del testo. */
  private drawHeaderTag(left: number, baseline: number, size: number) {
    const tag = this.options.tag;
    if (!tag) return;
    const { bold } = this.fonts;
    const text = this.safe(tag.text);
    const tagSize = size - 0.5;
    const x = left + bold.widthOfTextAtSize(this.safe("Volley Lignano"), size) + 10;
    this.drawPill(x, baseline, bold.widthOfTextAtSize(text, tagSize), tagSize, toneColor(tag.tone, this.palette));
    this.page.drawText(text, { x, y: baseline, size: tagSize, font: bold, color: WHITE });
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
    this.drawHeaderTag(left, this.yOf(this.cursor + 11), 9);
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
    this.drawHeaderTag(MARGIN, this.yOf(this.cursor + 8), 8.5);
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

  /** Va a una pagina nuova. */
  pageBreak() {
    this.addPage();
  }

  /** Va a una pagina nuova se non restano almeno `height` punti: serve a non lasciare un titolo da solo in fondo alla pagina. */
  requireSpace(height: number) {
    this.ensureSpace(height);
  }

  /** Riserva `height` punti (a capo pagina se non ci stanno) e lascia disegnare liberamente al suo interno. */
  canvas(height: number, draw: (canvas: PdfCanvas) => void) {
    this.ensureSpace(height);
    draw({
      page: this.page,
      fonts: this.fonts,
      colors: {
        ink: INK,
        muted: MUTED,
        border: BORDER,
        primary: this.palette.primary,
        dark: this.palette.dark,
        soft: this.palette.soft,
        accent: ACCENT,
      },
      left: MARGIN,
      top: this.yOf(this.cursor),
      width: this.contentW,
      height,
      safe: this.safe,
    });
    this.cursor += height + 10;
  }

  /**
   * Sottotitolo di sezione (più piccolo di `heading`). `keepWith` è lo spazio
   * che deve restare sotto di lui nella stessa pagina: un titolo non rimane mai
   * solo in fondo. `gapBefore` è l'aria sopra, che in cima a una pagina nuova si salta.
   */
  subheading(title: string, options: { gapBefore?: number; keepWith?: number } = {}) {
    const gapBefore = options.gapBefore ?? 0;
    const needed = gapBefore + 18 + (options.keepWith ?? 28);
    if (!this.ensureSpace(Math.min(needed, this.pageCapacity))) this.cursor += gapBefore;
    this.page.drawText(this.safe(title), {
      x: MARGIN,
      y: this.yOf(this.cursor + 10),
      size: 10.5,
      font: this.fonts.bold,
      color: INK,
    });
    this.cursor += 18;
  }

  /** Altezza di un paragrafo con grassetti nella larghezza data, per decidere prima dove metterlo. */
  private runsHeight(value: string, width: number, size: number): number {
    return wrapRuns(this.fonts, parseRuns(this.safe(value)), width, size).length * size * LINE_FACTOR;
  }

  /**
   * Altezza delle righe che all'inizio di un paragrafo devono stare insieme
   * (tutte se è corto, altrimenti le prime tre): serve a decidere prima se un
   * titolo che lo precede ci sta senza restare solo in fondo alla pagina.
   */
  richTextHead(value: string, options: { size?: number; indent?: number; width?: number } = {}): number {
    const size = options.size ?? 9.5;
    const width = options.width ?? this.contentW - (options.indent ?? 0);
    const count = wrapRuns(this.fonts, parseRuns(this.safe(value)), width, size).length;
    return (count <= KEEP_LINES ? count : 3) * size * LINE_FACTOR;
  }

  /**
   * Paragrafo con «**grassetti**» a capo da solo. `indent` sposta tutto il
   * blocco a destra; `width` lo stringe (es. accanto a un'immagine). Un
   * paragrafo corto non si spezza tra due pagine, e uno lungo non lascia mai
   * una riga sola da una parte. `keepWith` è lo spazio che deve restare sotto
   * un paragrafo corto nella stessa pagina (es. la lista che introduce).
   */
  richText(
    value: string,
    options: { size?: number; tone?: PdfTone; gapAfter?: number; indent?: number; width?: number; keepWith?: number } = {},
  ) {
    const size = options.size ?? 9.5;
    const indent = options.indent ?? 0;
    const width = options.width ?? this.contentW - indent;
    const lines = wrapRuns(this.fonts, parseRuns(this.safe(value)), width, size);
    const lineHeight = size * LINE_FACTOR;
    const color = toneColor(options.tone ?? "default", this.palette);
    if (lines.length <= KEEP_LINES) this.ensureSpace(lines.length * lineHeight + (options.keepWith ?? 0));

    let index = 0;
    while (index < lines.length) {
      const remaining = lines.length - index;
      let take = Math.min(remaining, Math.floor((this.bottomLimit - this.cursor) / lineHeight));
      // Se il paragrafo continua nella pagina dopo, non si lascia una riga sola né in fondo né in cima.
      if (take < remaining && remaining - take < 2) take = remaining - 2;
      if (take < Math.min(2, remaining)) {
        this.addPage();
        continue;
      }
      for (const line of lines.slice(index, index + take)) {
        let x = MARGIN + indent;
        for (const run of line) {
          const font = run.bold ? this.fonts.bold : this.fonts.regular;
          this.page.drawText(run.text, { x, y: this.yOf(this.cursor + size), size, font, color });
          x += font.widthOfTextAtSize(run.text, size);
        }
        this.cursor += lineHeight;
      }
      index += take;
      if (index < lines.length) this.addPage();
    }
    this.cursor += options.gapAfter ?? 6;
  }

  /** Elenco puntato: un pallino davanti a ogni voce, che non si spezza tra due pagine. */
  bullets(items: string[], options: { size?: number; gapAfter?: number } = {}) {
    const size = options.size ?? 9.5;
    const textIndent = 14;
    for (const item of items) {
      this.ensureSpace(this.runsHeight(item, this.contentW - textIndent, size) + 2);
      this.page.drawCircle({
        x: MARGIN + 4,
        y: this.yOf(this.cursor + size * 0.62),
        size: 1.8,
        color: this.palette.primary,
      });
      this.richText(item, { size, indent: textIndent, gapAfter: 2.5 });
    }
    this.cursor += options.gapAfter ?? 5;
  }

  /** Elenco numerato: il numero sta in un cerchio colorato, come i marcatori delle schermate. */
  numbered(items: string[], options: { size?: number; gapAfter?: number } = {}) {
    const size = options.size ?? 9.5;
    const textIndent = 20;
    items.forEach((item, index) => {
      this.ensureSpace(this.runsHeight(item, this.contentW - textIndent, size) + 4);
      const centerY = this.yOf(this.cursor + size * 0.62);
      this.page.drawCircle({ x: MARGIN + 7, y: centerY, size: 7.2, color: this.palette.primary });
      const label = String(index + 1);
      const labelWidth = this.fonts.bold.widthOfTextAtSize(label, 8);
      this.page.drawText(label, { x: MARGIN + 7 - labelWidth / 2, y: centerY - 2.8, size: 8, font: this.fonts.bold, color: WHITE });
      this.richText(item, { size, indent: textIndent, gapAfter: 3.5 });
    });
    this.cursor += options.gapAfter ?? 5;
  }

  /** Come si dispone un riquadro: righe a capo, altezza, colori. */
  private layoutCallout(kind: PdfCalloutKind, text: string, options: { title?: string; size?: number }) {
    const style = this.calloutStyle(kind);
    const size = options.size ?? 9;
    const padX = 11;
    const padY = 8;
    const barWidth = 3.5;
    const innerWidth = this.contentW - barWidth - padX * 2;
    const title = options.title ?? style.label;
    const titleHeight = title ? size * LINE_FACTOR + 1.5 : 0;
    const bodyLines = wrapRuns(this.fonts, parseRuns(this.safe(text)), innerWidth, size);
    const height = padY * 2 + titleHeight + bodyLines.length * size * LINE_FACTOR;
    return { style, size, padX, padY, barWidth, title, titleHeight, bodyLines, height };
  }

  /** Altezza che occuperebbe un riquadro, per decidere prima dove metterlo (o se un titolo che lo precede ci sta). */
  calloutHeight(kind: PdfCalloutKind, text: string, options: { title?: string; size?: number } = {}): number {
    return this.layoutCallout(kind, text, options).height + 9;
  }

  /** Riquadro evidenziato (consiglio, attenzione, esempio, informazione), che non si spezza tra due pagine. */
  callout(kind: PdfCalloutKind, text: string, options: { title?: string; size?: number } = {}) {
    const { style, size, padX, padY, barWidth, title, titleHeight, bodyLines, height } = this.layoutCallout(kind, text, options);
    this.ensureSpace(height + 4);
    const top = this.cursor;
    this.page.drawRectangle({ x: MARGIN, y: this.yOf(top + height), width: this.contentW, height, color: style.background });
    this.page.drawRectangle({ x: MARGIN, y: this.yOf(top + height), width: barWidth, height, color: style.bar });
    let y = top + padY;
    if (title) {
      this.page.drawText(this.safe(title), { x: MARGIN + barWidth + padX, y: this.yOf(y + size), size, font: this.fonts.bold, color: style.bar });
      y += titleHeight;
    }
    for (const line of bodyLines) {
      let x = MARGIN + barWidth + padX;
      for (const run of line) {
        const font = run.bold ? this.fonts.bold : this.fonts.regular;
        this.page.drawText(run.text, { x, y: this.yOf(y + size), size, font, color: INK });
        x += font.widthOfTextAtSize(run.text, size);
      }
      y += size * LINE_FACTOR;
    }
    this.cursor += height + 9;
  }

  private calloutStyle(kind: PdfCalloutKind): CalloutStyle {
    switch (kind) {
      case "tip":
        return { bar: SUCCESS, background: rgb(0.925, 0.976, 0.945), label: "Consiglio" };
      case "warning":
        return { bar: rgb(0xb4 / 255, 0x53 / 255, 0x09 / 255), background: rgb(1, 0.957, 0.89), label: "Attenzione" };
      case "example":
        return { bar: this.palette.primary, background: this.palette.soft, label: "Esempio" };
      default:
        return { bar: MUTED, background: ZEBRA, label: "" };
    }
  }

  /** Dove vanno una schermata, la sua didascalia e la sua legenda: si tengono insieme, nella stessa pagina. */
  private imageLayout(embedded: PDFImage, options: PdfImageOptions) {
    const maxWidth = Math.min(options.maxWidth ?? this.contentW, this.contentW);
    const maxHeight = options.maxHeight ?? this.pageH * 0.56;
    const scale = Math.min(maxWidth / embedded.width, maxHeight / embedded.height);
    const width = embedded.width * scale;
    const height = embedded.height * scale;
    const captionLines = options.caption ? wrapRuns(this.fonts, parseRuns(this.safe(options.caption)), maxWidth, SUB_SIZE + 0.5) : [];
    const captionHeight = captionLines.length > 0 ? captionLines.length * (SUB_SIZE + 0.5) * LINE_FACTOR + 5 : 0;
    const legend = options.legend && options.legend.length > 0 ? this.layoutLegend(options.legend, 8.5) : null;
    const total = height + captionHeight + 10 + (legend ? legend.height + 6 : 0);
    return { width, height, captionLines, legend, total };
  }

  /**
   * Disegna un'immagine (PNG o JPEG) alla larghezza della pagina, con didascalia
   * e, se c'è, la legenda dei suoi marcatori: a pagina nuova se non ci sta tutto.
   */
  async image(bytes: Uint8Array, options: PdfImageOptions = {}) {
    const embedded = await this.embedImage(bytes);
    const { width, height, captionLines, legend, total } = this.imageLayout(embedded, options);
    this.ensureSpace(total);
    const x = MARGIN + (this.contentW - width) / 2;
    this.page.drawRectangle({
      x: x - 0.5,
      y: this.yOf(this.cursor + height) - 0.5,
      width: width + 1,
      height: height + 1,
      borderColor: BORDER,
      borderWidth: 0.75,
    });
    this.page.drawImage(embedded, { x, y: this.yOf(this.cursor + height), width, height });
    this.cursor += height + 5;
    for (const line of captionLines) {
      let cx = MARGIN + (this.contentW - width) / 2;
      for (const run of line) {
        const font = run.bold ? this.fonts.bold : this.fonts.regular;
        this.page.drawText(run.text, { x: cx, y: this.yOf(this.cursor + SUB_SIZE), size: SUB_SIZE + 0.5, font, color: MUTED });
        cx += font.widthOfTextAtSize(run.text, SUB_SIZE + 0.5);
      }
      this.cursor += (SUB_SIZE + 0.5) * LINE_FACTOR;
    }
    this.cursor += captionLines.length > 0 ? 9 : 8;
    if (legend) this.drawLegend(legend);
  }

  /** Altezza di un'immagine con didascalia e legenda, per decidere prima se un titolo che la precede ci sta. */
  async measureImage(bytes: Uint8Array, options: PdfImageOptions = {}): Promise<number> {
    return this.imageLayout(await this.embedImage(bytes), options).total;
  }

  /** Dove vanno più immagini affiancate, le loro didascalie e la legenda. */
  private imageRowLayout(
    embedded: PDFImage[],
    items: { caption?: string }[],
    options: { maxHeight?: number; gap?: number; legend?: string[] },
  ) {
    const gap = options.gap ?? 14;
    const available = this.contentW - gap * (items.length - 1);
    const maxHeight = options.maxHeight ?? this.pageH * 0.5;
    // Stessa altezza per tutte; si riduce finché le larghezze ci stanno in riga.
    const ratioSum = embedded.reduce((sum, img) => sum + img.width / img.height, 0);
    const height = Math.min(maxHeight, available / ratioSum);
    const widths = embedded.map((img) => (img.width / img.height) * height);
    const totalWidth = widths.reduce((sum, w) => sum + w, 0) + gap * (items.length - 1);
    const captionSize = SUB_SIZE + 0.5;
    const captions = items.map((item, i) =>
      item.caption ? wrapRuns(this.fonts, parseRuns(this.safe(item.caption)), Math.max(widths[i], 60), captionSize) : [],
    );
    const captionHeight = Math.max(...captions.map((c) => c.length)) * captionSize * LINE_FACTOR + 5;
    const legend = options.legend && options.legend.length > 0 ? this.layoutLegend(options.legend, 8.5) : null;
    const total = height + captionHeight + 10 + (legend ? legend.height + 6 : 0);
    return { gap, height, widths, totalWidth, captionSize, captions, captionHeight, legend, total };
  }

  /**
   * Più immagini affiancate (es. schermate del telefono), tutte della stessa
   * altezza, ognuna con la sua didascalia; la legenda, se c'è, resta con loro.
   */
  async imageRow(
    items: { bytes: Uint8Array; caption?: string }[],
    options: { maxHeight?: number; gap?: number; legend?: string[] } = {},
  ) {
    const embedded = await Promise.all(items.map((item) => this.embedImage(item.bytes)));
    const { gap, height, widths, totalWidth, captionSize, captions, captionHeight, legend, total } = this.imageRowLayout(
      embedded,
      items,
      options,
    );
    this.ensureSpace(total);
    let x = MARGIN + (this.contentW - totalWidth) / 2;
    embedded.forEach((img, i) => {
      this.page.drawRectangle({
        x: x - 0.5,
        y: this.yOf(this.cursor + height) - 0.5,
        width: widths[i] + 1,
        height: height + 1,
        borderColor: BORDER,
        borderWidth: 0.75,
      });
      this.page.drawImage(img, { x, y: this.yOf(this.cursor + height), width: widths[i], height });
      let cy = this.cursor + height + 5;
      for (const line of captions[i]) {
        let cx = x;
        for (const run of line) {
          const font = run.bold ? this.fonts.bold : this.fonts.regular;
          this.page.drawText(run.text, { x: cx, y: this.yOf(cy + captionSize), size: captionSize, font, color: MUTED });
          cx += font.widthOfTextAtSize(run.text, captionSize);
        }
        cy += captionSize * LINE_FACTOR;
      }
      x += widths[i] + gap;
    });
    this.cursor += height + captionHeight + 9;
    if (legend) this.drawLegend(legend);
  }

  /** Altezza di una fila di immagini con didascalie e legenda, per decidere prima se un titolo che la precede ci sta. */
  async measureImageRow(
    items: { bytes: Uint8Array; caption?: string }[],
    options: { maxHeight?: number; gap?: number; legend?: string[] } = {},
  ): Promise<number> {
    const embedded = await Promise.all(items.map((item) => this.embedImage(item.bytes)));
    return this.imageRowLayout(embedded, items, options).total;
  }

  /** Incorpora l'immagine una volta sola, anche se la si misura prima di disegnarla. */
  private embedImage(bytes: Uint8Array): Promise<PDFImage> {
    let embedded = this.embeddedImages.get(bytes);
    if (!embedded) {
      // PNG comincia con 0x89 'PNG', JPEG con 0xFF 0xD8.
      embedded = bytes[0] === 0x89 ? this.doc.embedPng(bytes) : this.doc.embedJpg(bytes);
      this.embeddedImages.set(bytes, embedded);
    }
    return embedded;
  }

  /** Come si dispone una legenda di marcatori numerati: su due colonne se le voci sono più di quattro. */
  private layoutLegend(items: string[], size: number): LegendLayout {
    const columns = items.length > 4 ? 2 : 1;
    const gap = 16;
    const columnWidth = (this.contentW - gap * (columns - 1)) / columns;
    const textIndent = 17;
    const perColumn = Math.ceil(items.length / columns);
    const heights = items.map((item) => Math.max(this.runsHeight(item, columnWidth - textIndent, size), size * LINE_FACTOR) + 3);
    const columnHeights = Array.from({ length: columns }, (_, c) =>
      heights.slice(c * perColumn, (c + 1) * perColumn).reduce((sum, h) => sum + h, 0),
    );
    return { items, size, columns, gap, columnWidth, textIndent, perColumn, heights, height: Math.max(...columnHeights) };
  }

  private drawLegend(layout: LegendLayout) {
    const { items, size, columns, gap, columnWidth, textIndent, perColumn, heights } = layout;
    const top = this.cursor;
    for (let c = 0; c < columns; c++) {
      let y = top;
      for (let i = c * perColumn; i < Math.min(items.length, (c + 1) * perColumn); i++) {
        const x = MARGIN + c * (columnWidth + gap);
        const centerY = this.yOf(y + size * 0.62);
        this.page.drawCircle({ x: x + 6, y: centerY, size: 6, color: this.palette.primary });
        const label = String(i + 1);
        const labelWidth = this.fonts.bold.widthOfTextAtSize(label, 7.5);
        this.page.drawText(label, { x: x + 6 - labelWidth / 2, y: centerY - 2.6, size: 7.5, font: this.fonts.bold, color: WHITE });
        const lines = wrapRuns(this.fonts, parseRuns(this.safe(items[i])), columnWidth - textIndent, size);
        lines.forEach((line, lineIndex) => {
          let tx = x + textIndent;
          for (const run of line) {
            const font = run.bold ? this.fonts.bold : this.fonts.regular;
            this.page.drawText(run.text, { x: tx, y: this.yOf(y + lineIndex * size * LINE_FACTOR + size), size, font, color: INK });
            tx += font.widthOfTextAtSize(run.text, size);
          }
        });
        y += heights[i];
      }
    }
    this.cursor += layout.height + 8;
  }

  /** Legenda dei marcatori numerati di una schermata: ogni voce con il suo cerchio, su due colonne se sono tante. */
  legend(items: string[], options: { size?: number } = {}) {
    const layout = this.layoutLegend(items, options.size ?? 8.5);
    this.ensureSpace(layout.height + 6);
    this.drawLegend(layout);
  }

  /** Titolo di capitolo: comincia su una pagina nuova, con numero grande, titolo e una riga di presentazione. */
  chapter(number: number, title: string, summary?: string) {
    this.addPage();
    const { regular, bold } = this.fonts;
    const centerY = this.yOf(this.cursor + 20);
    this.page.drawCircle({ x: MARGIN + 20, y: centerY, size: 20, color: this.palette.primary });
    const label = String(number);
    const labelWidth = bold.widthOfTextAtSize(label, 20);
    this.page.drawText(label, { x: MARGIN + 20 - labelWidth / 2, y: centerY - 7, size: 20, font: bold, color: WHITE });
    this.page.drawText(this.safe(title), { x: MARGIN + 52, y: this.yOf(this.cursor + 18), size: 19, font: bold, color: INK });
    this.cursor += 46;
    if (summary) {
      const lines = wrapLines(regular, this.safe(summary), this.contentW - 52, 10);
      for (const line of lines) {
        this.page.drawText(line, { x: MARGIN + 52, y: this.yOf(this.cursor - 6), size: 10, font: regular, color: MUTED });
        this.cursor += 10 * LINE_FACTOR;
      }
      this.cursor += 2;
    }
    this.page.drawLine({
      start: { x: MARGIN, y: this.yOf(this.cursor) },
      end: { x: this.pageW - MARGIN, y: this.yOf(this.cursor) },
      thickness: 1,
      color: BORDER,
    });
    this.cursor += 16;
  }

  /** Indice (0) della pagina su cui si sta scrivendo: serve a ricordare dove comincia un capitolo. */
  get currentPageIndex() {
    return this.pages.length - 1;
  }

  /** Altezza ancora libera nella pagina corrente. */
  get remainingSpace() {
    return this.bottomLimit - this.cursor;
  }

  /**
   * Torna a disegnare su una pagina già scritta (es. l'indice, riempito alla
   * fine quando si conoscono i numeri di pagina). Lo spazio è quello sotto
   * l'intestazione ripetuta.
   */
  drawOnPage(index: number, draw: (canvas: PdfCanvas) => void) {
    const page = this.pages[index];
    if (!page) return;
    const top = MARGIN + RUNNING_HEADER_HEIGHT;
    draw({
      page,
      fonts: this.fonts,
      colors: {
        ink: INK,
        muted: MUTED,
        border: BORDER,
        primary: this.palette.primary,
        dark: this.palette.dark,
        soft: this.palette.soft,
        accent: ACCENT,
      },
      left: MARGIN,
      top: this.yOf(top),
      width: this.contentW,
      height: this.bottomLimit - top,
      safe: this.safe,
    });
  }

  /** Il riquadro pieno dietro un testo che parte da `x` con la base a `baseline` (il testo, bianco, lo scrive chi chiama). */
  private drawPill(x: number, baseline: number, textWidth: number, size: number, color: RGB) {
    this.page.drawRectangle({
      x: x - PILL_PAD_X,
      y: baseline - size * 0.27,
      width: textWidth + PILL_PAD_X * 2,
      height: size * 1.2,
      color,
    });
  }

  private columnWidths(columns: PdfColumn[]): number[] {
    const total = columns.reduce((sum, c) => sum + c.weight, 0);
    return columns.map((c) => (c.weight / total) * this.contentW);
  }

  private prepareCell(cell: PdfCellInput, width: number, m: TableMetrics): PreparedCell {
    const { regular, bold } = this.fonts;
    const input: PdfCell = typeof cell === "string" ? { text: cell } : cell;
    const innerWidth = width - m.padX * 2;
    const font = input.bold ? bold : regular;
    const lines = limitLines(font, wrapLines(font, this.safe(input.text), innerWidth, m.body), innerWidth, m.body, MAX_CELL_LINES);
    const subLines = input.sub
      ? limitLines(regular, wrapLines(regular, this.safe(input.sub), innerWidth, m.sub), innerWidth, m.sub, MAX_CELL_LINES)
      : [];
    const textHeight = Math.max(lines.length, 1) * m.body * LINE_FACTOR + subLines.length * m.sub * LINE_FACTOR;
    return {
      lines,
      subLines,
      bold: Boolean(input.bold),
      color: toneColor(input.tone, this.palette),
      subColor: input.subTone ? toneColor(input.subTone, this.palette) : MUTED,
      pill: Boolean(input.pill),
      bar: input.bar ? toneColor(input.bar, this.palette) : null,
      height: textHeight + m.padY * 2,
    };
  }

  /** Intestazioni di colonna: a capo se serve, al massimo su tre righe. */
  private headerLines(columns: PdfColumn[], widths: number[], m: TableMetrics): string[][] {
    const { bold } = this.fonts;
    return columns.map((column, i) => {
      const inner = widths[i] - m.padX * 2;
      return limitLines(bold, wrapLines(bold, this.safe(column.header), inner, m.header), inner, m.header, 3);
    });
  }

  private headerHeight(headerLines: string[][], m: TableMetrics): number {
    return Math.max(...headerLines.map((lines) => lines.length), 1) * m.header * LINE_FACTOR + m.padY * 2 + 2;
  }

  private drawTableHeader(columns: PdfColumn[], widths: number[], m: TableMetrics) {
    const { bold } = this.fonts;
    const lines = this.headerLines(columns, widths, m);
    const headerH = this.headerHeight(lines, m);
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
        const labelWidth = bold.widthOfTextAtSize(label, m.header);
        const textX =
          column.align === "right"
            ? x + widths[i] - m.padX - labelWidth
            : column.align === "center"
              ? x + (widths[i] - labelWidth) / 2
              : x + m.padX;
        this.page.drawText(label, {
          x: textX,
          y: this.yOf(this.cursor + m.padY + 1 + m.header + lineIndex * m.header * LINE_FACTOR),
          size: m.header,
          font: bold,
          color: WHITE,
        });
      });
      x += widths[i];
    });
    this.cursor += headerH;
  }

  /** Altezza che occuperebbe la tabella (intestazione e tutte le righe), per decidere prima dove metterla. */
  tableHeight(columns: PdfColumn[], rows: PdfCellInput[][], options: { compact?: boolean } = {}): number {
    const m = options.compact ? TABLE_COMPACT : TABLE_NORMAL;
    const widths = this.columnWidths(columns);
    const headerH = this.headerHeight(this.headerLines(columns, widths, m), m);
    const bodyH = rows.reduce(
      (sum, row) => sum + Math.max(...columns.map((_, i) => this.prepareCell(row[i] ?? "", widths[i], m).height)),
      0,
    );
    return headerH + bodyH;
  }

  /** Tabella: l'intestazione si ripete a ogni pagina e una riga non si spezza mai tra due pagine. */
  table(columns: PdfColumn[], rows: PdfCellInput[][], options: PdfTableOptions = {}) {
    const m = options.compact ? TABLE_COMPACT : TABLE_NORMAL;
    const widths = this.columnWidths(columns);
    const headerH = this.headerHeight(this.headerLines(columns, widths, m), m);

    if (rows.length === 0) {
      this.text(options.emptyText ?? "Nessun dato.", { tone: "muted", gapAfter: 12 });
      return;
    }

    const prepared = rows.map((row) => {
      const cells = columns.map((_, i) => this.prepareCell(row[i] ?? "", widths[i], m));
      return { cells, height: Math.max(...cells.map((c) => c.height)) };
    });

    // Una tabella che sta in una pagina intera, ma non nello spazio rimasto, comincia in quella nuova.
    if (options.keepTogether) {
      const total = headerH + prepared.reduce((sum, row) => sum + row.height, 0);
      const pageCapacity = this.bottomLimit - (MARGIN + RUNNING_HEADER_HEIGHT);
      if (total <= pageCapacity) this.ensureSpace(total);
    }
    this.ensureSpace(headerH + prepared[0].height);
    this.drawTableHeader(columns, widths, m);

    prepared.forEach((row, rowIndex) => {
      if (this.cursor + row.height > this.bottomLimit) {
        this.addPage();
        this.drawTableHeader(columns, widths, m);
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
        let lineTop = top + m.padY;
        if (cell.bar) {
          this.page.drawRectangle({ x, y: this.yOf(top + row.height), width: BAR_WIDTH, height: row.height, color: cell.bar });
        }
        const drawLine = (text: string, size: number, font: PDFFont, color: RGB, pill = false) => {
          const width = font.widthOfTextAtSize(text, size);
          const textX =
            align === "right" ? x + widths[i] - m.padX - width : align === "center" ? x + (widths[i] - width) / 2 : x + m.padX;
          if (pill) this.drawPill(textX, this.yOf(lineTop + size), width, size, color);
          this.page.drawText(text, { x: textX, y: this.yOf(lineTop + size), size, font, color: pill ? WHITE : color });
          lineTop += size * LINE_FACTOR;
        };
        const mainFont = cell.bold || cell.pill ? this.fonts.bold : this.fonts.regular;
        for (const line of cell.lines) drawLine(line, m.body, mainFont, cell.color, cell.pill);
        for (const line of cell.subLines) drawLine(line, m.sub, this.fonts.regular, cell.subColor);
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
