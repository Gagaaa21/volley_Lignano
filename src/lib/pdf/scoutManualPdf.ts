import { readFile } from "node:fs/promises";
import path from "node:path";
import { rgb } from "pdf-lib";
import {
  GLOSSARY,
  MANUAL_TAGLINE,
  MANUAL_TITLE,
  SCOUT_MANUAL,
  type ManualBlock,
  type ManualChapter,
} from "@/lib/scout/manual";
import { asksPlayer, ERROR_HOWS, HOW_META } from "@/lib/scout/rules";
import { PdfReport, type PdfCanvas, type PdfCellInput } from "./report";

/**
 * Il manuale d'uso dello Scout in PDF: copertina, indice con i numeri di
 * pagina, un capitolo per argomento (testo in src/lib/scout/manual.ts, schermate
 * in src/assets/pdf/scout-manual) e una scheda rapida da stampare.
 */

const IMAGE_DIR = path.join(process.cwd(), "src/assets/pdf/scout-manual");

const WHITE = rgb(1, 1, 1);
const SOFT_WHITE = rgb(0.82, 0.88, 0.96);
const SEA = rgb(0.04, 0.1, 0.16);
const GREEN = rgb(0.29, 0.87, 0.5);

/** Le schermate già lette dal disco: la stessa serve per misurare un blocco e poi per disegnarlo. */
type ImageCache = Map<string, Promise<Uint8Array | null>>;

/** Una schermata del manuale; se il file manca la pagina si impagina lo stesso, senza. */
function loadImage(cache: ImageCache, file: string): Promise<Uint8Array | null> {
  let image = cache.get(file);
  if (!image) {
    image = readFile(path.join(IMAGE_DIR, file)).then(
      (bytes): Uint8Array | null => bytes,
      () => null,
    );
    cache.set(file, image);
  }
  return image;
}

const COVER_HEIGHT = 334;

/** Copertina: un riquadro scuro con un tabellone di esempio, come quello dello Scout. */
function drawCover(canvas: PdfCanvas) {
  const { page, fonts, colors, left, top, width, height } = canvas;
  const bottom = top - height;
  page.drawRectangle({ x: left, y: bottom, width, height, color: colors.dark });

  const pad = 26;
  page.drawText("SCOUT", { x: left + pad, y: top - 38, size: 12, font: fonts.bold, color: colors.accent });
  page.drawText("Manuale d'uso", { x: left + pad, y: top - 76, size: 34, font: fonts.bold, color: WHITE });
  page.drawText(canvas.safe("Per chi segna i punti · Under 14 e Under 15"), {
    x: left + pad,
    y: top - 98,
    size: 12,
    font: fonts.regular,
    color: SOFT_WHITE,
  });

  // Il tabellone: Noi - punteggio - Loro.
  const boardTop = top - 124;
  const boardHeight = 112;
  const boardWidth = width - pad * 2;
  const boardLeft = left + pad;
  page.drawRectangle({ x: boardLeft, y: boardTop - boardHeight, width: boardWidth, height: boardHeight, color: SEA });
  page.drawText("3° SET  A 25", { x: boardLeft + 16, y: boardTop - 22, size: 8.5, font: fonts.bold, color: rgb(0.6, 0.68, 0.78) });
  const sets = "SET VINTI 1-1";
  page.drawText(sets, {
    x: boardLeft + boardWidth - 16 - fonts.bold.widthOfTextAtSize(sets, 8.5),
    y: boardTop - 22,
    size: 8.5,
    font: fonts.bold,
    color: rgb(0.6, 0.68, 0.78),
  });
  page.drawText("NOI", { x: boardLeft + 24, y: boardTop - 66, size: 15, font: fonts.bold, color: rgb(0.55, 0.78, 0.98) });
  page.drawText("LORO", {
    x: boardLeft + boardWidth - 24 - fonts.bold.widthOfTextAtSize("LORO", 15),
    y: boardTop - 66,
    size: 15,
    font: fonts.bold,
    color: colors.accent,
  });
  const score = "18 - 15";
  page.drawText(score, {
    x: boardLeft + (boardWidth - fonts.bold.widthOfTextAtSize(score, 50)) / 2,
    y: boardTop - 82,
    size: 50,
    font: fonts.bold,
    color: WHITE,
  });
  page.drawCircle({ x: boardLeft + 30, y: boardTop - 90, size: 3, color: GREEN });
  page.drawText("BATTE", { x: boardLeft + 38, y: boardTop - 93, size: 8, font: fonts.bold, color: WHITE });

  // I due pulsanti: Punto nostro / Punto loro.
  const buttonsTop = boardTop - boardHeight - 14;
  const buttonWidth = (boardWidth - 12) / 2;
  page.drawRectangle({ x: boardLeft, y: buttonsTop - 30, width: buttonWidth, height: 30, color: colors.soft });
  page.drawText("Punto nostro", { x: boardLeft + 14, y: buttonsTop - 20, size: 12, font: fonts.bold, color: colors.primary });
  page.drawRectangle({ x: boardLeft + buttonWidth + 12, y: buttonsTop - 30, width: buttonWidth, height: 30, color: colors.accent });
  page.drawText("Punto loro", { x: boardLeft + buttonWidth + 26, y: buttonsTop - 20, size: 12, font: fonts.bold, color: SEA });

  const tagline = canvas.safe(MANUAL_TAGLINE);
  page.drawText(tagline, {
    x: left + (width - fonts.bold.widthOfTextAtSize(tagline, 13)) / 2,
    y: bottom + 18,
    size: 13,
    font: fonts.bold,
    color: WHITE,
  });
}

/** Le voci di errore e di fallo, ricavate da HOW_META. */
function howRows(): PdfCellInput[][] {
  return ERROR_HOWS.map((how) => {
    const meta = HOW_META[how];
    return [
      { text: meta.label, bold: true },
      meta.group === "foul" ? "Fallo fischiato" : "Errore di gioco",
      meta.hint,
      asksPlayer(how) ? "Sì" : "No: riguarda tutta la squadra",
    ];
  });
}

const PARAGRAPH_SIZE = 9.5;

const HOWS_COLUMNS = [
  { header: "Voce", weight: 3 },
  { header: "Tipo", weight: 2.4 },
  { header: "Quando si usa", weight: 5 },
  { header: "Chiede la giocatrice?", weight: 2.8 },
];

const GLOSSARY_COLUMNS = [
  { header: "Parola", weight: 2.4 },
  { header: "Cosa vuol dire", weight: 8 },
];

function glossaryRows(): PdfCellInput[][] {
  return [...GLOSSARY]
    .sort((a, b) => a.term.localeCompare(b.term, "it"))
    .map((entry) => [{ text: entry.term, bold: true }, entry.text]);
}

/** La prima colonna di una tabella del manuale è in grassetto. */
function tableRows(rows: string[][]): PdfCellInput[][] {
  return rows.map((row) => row.map((text, i) => (i === 0 && text !== "" ? { text, bold: true } : text)));
}

/** Una frase che finisce con i due punti introduce quello che segue: le due cose stanno nella stessa pagina. */
function introducesNext(text: string): boolean {
  return /:\s*$/.test(text);
}

interface RenderContext {
  report: PdfReport;
  /** Tutti i blocchi del capitolo: serve a guardare quello che viene dopo. */
  blocks: ManualBlock[];
  images: ImageCache;
}

/** Le schermate di un blocco «images» che esistono davvero sul disco. */
async function availableImages(ctx: RenderContext, items: { file: string; caption: string }[]) {
  const loaded = await Promise.all(items.map(async (item) => ({ bytes: await loadImage(ctx.images, item.file), caption: item.caption })));
  return loaded.filter((item): item is { bytes: Uint8Array; caption: string } => item.bytes !== null);
}

/**
 * Lo spazio che serve in testa al blocco `index` perché un titolo (o la frase
 * che lo introduce) non resti da solo in fondo a una pagina: le prime righe di
 * un testo, di un elenco o di una tabella, oppure un riquadro o una schermata
 * interi, che non si spezzano.
 */
async function headHeight(ctx: RenderContext, index: number): Promise<number> {
  const block = ctx.blocks[index];
  if (!block) return 0;
  const { report } = ctx;
  switch (block.type) {
    case "p": {
      const own = report.richTextHead(block.text, { size: PARAGRAPH_SIZE }) + 7;
      return introducesNext(block.text) ? own + (await headHeight(ctx, index + 1)) : own;
    }
    case "sub":
      return 0;
    case "bullets":
      return report.richTextHead(block.items[0] ?? "", { size: PARAGRAPH_SIZE, indent: 14 }) + 3;
    case "steps":
      return report.richTextHead(block.items[0] ?? "", { size: PARAGRAPH_SIZE, indent: 20 }) + 4;
    case "callout":
      return report.calloutHeight(block.kind, block.text, { title: block.title });
    case "image": {
      const bytes = await loadImage(ctx.images, block.file);
      if (!bytes) return 0;
      return report.measureImage(bytes, { caption: block.caption, maxHeight: block.maxHeight, maxWidth: block.maxWidth, legend: block.legend });
    }
    case "images": {
      const available = await availableImages(ctx, block.items);
      if (available.length === 0) return 0;
      return report.measureImageRow(available, { maxHeight: block.maxHeight, legend: block.legend });
    }
    case "table":
      return report.tableHeight(block.columns, tableRows(block.keepTogether ? block.rows : block.rows.slice(0, 2)));
    case "hows":
      return report.tableHeight(HOWS_COLUMNS, howRows().slice(0, 2));
    case "glossary":
      return report.tableHeight(GLOSSARY_COLUMNS, glossaryRows().slice(0, 2));
  }
}

async function renderBlock(ctx: RenderContext, index: number) {
  const { report } = ctx;
  const block = ctx.blocks[index];
  switch (block.type) {
    case "p":
      report.richText(block.text, {
        size: PARAGRAPH_SIZE,
        gapAfter: 7,
        keepWith: introducesNext(block.text) ? await headHeight(ctx, index + 1) : 0,
      });
      return;
    case "sub":
      report.subheading(block.title, { gapBefore: 5, keepWith: await headHeight(ctx, index + 1) });
      return;
    case "bullets":
      report.bullets(block.items);
      return;
    case "steps":
      report.numbered(block.items);
      return;
    case "callout":
      report.callout(block.kind, block.text, { title: block.title });
      return;
    case "image": {
      const bytes = await loadImage(ctx.images, block.file);
      if (!bytes) return;
      await report.image(bytes, { caption: block.caption, maxHeight: block.maxHeight, maxWidth: block.maxWidth, legend: block.legend });
      return;
    }
    case "images": {
      const available = await availableImages(ctx, block.items);
      if (available.length === 0) return;
      await report.imageRow(available, { maxHeight: block.maxHeight, legend: block.legend });
      return;
    }
    case "table":
      report.table(block.columns, tableRows(block.rows), { keepTogether: block.keepTogether });
      return;
    case "hows":
      report.table(HOWS_COLUMNS, howRows(), { keepTogether: false });
      return;
    case "glossary":
      report.table(GLOSSARY_COLUMNS, glossaryRows());
      return;
  }
}

interface TocEntry {
  chapter: ManualChapter;
  number: number;
  page: number;
}

function drawToc(canvas: PdfCanvas, entries: TocEntry[]) {
  const { page, fonts, colors, left, top, width } = canvas;
  page.drawText("Indice", { x: left, y: top - 22, size: 22, font: fonts.bold, color: colors.ink });
  page.drawLine({ start: { x: left, y: top - 34 }, end: { x: left + width, y: top - 34 }, thickness: 1, color: colors.border });

  let y = top - 62;
  for (const entry of entries) {
    page.drawCircle({ x: left + 10, y: y + 3, size: 10, color: colors.primary });
    const label = String(entry.number);
    page.drawText(label, { x: left + 10 - fonts.bold.widthOfTextAtSize(label, 10) / 2, y: y - 0.5, size: 10, font: fonts.bold, color: WHITE });

    const title = canvas.safe(entry.chapter.title);
    page.drawText(title, { x: left + 32, y, size: 11.5, font: fonts.bold, color: colors.ink });
    const pageLabel = String(entry.page);
    const pageWidth = fonts.bold.widthOfTextAtSize(pageLabel, 11.5);
    page.drawText(pageLabel, { x: left + width - pageWidth, y, size: 11.5, font: fonts.bold, color: colors.primary });

    // Puntini di guida tra il titolo e il numero di pagina.
    const titleEnd = left + 32 + fonts.bold.widthOfTextAtSize(title, 11.5) + 8;
    const leaderEnd = left + width - pageWidth - 8;
    if (leaderEnd > titleEnd) {
      page.drawLine({
        start: { x: titleEnd, y: y + 2 },
        end: { x: leaderEnd, y: y + 2 },
        thickness: 0.8,
        color: colors.border,
        dashArray: [1, 3],
      });
    }
    page.drawText(canvas.safe(entry.chapter.summary), { x: left + 32, y: y - 13, size: 8.5, font: fonts.regular, color: colors.muted });
    y -= 40;
  }
}

/** Il manuale d'uso dello Scout, pronto da scaricare. */
export async function buildScoutManualPdf(options: { generatedAt?: Date } = {}): Promise<Uint8Array> {
  const report = await PdfReport.create({
    title: MANUAL_TITLE,
    subtitle: "Per chi segna i punti · Under 14 e Under 15",
    documentTitle: "Volley Lignano - Scout, manuale d'uso",
    footerLabel: "Volley Lignano · Scout, manuale d'uso",
    generatedAt: options.generatedAt,
  });

  report.canvas(COVER_HEIGHT, drawCover);
  report.spacer(8);
  report.heading("Lo Scout in tre mosse");
  report.numbered([
    "Scegli il **pannello** della squadra che ha fatto punto: «Punto nostro» oppure «Punto loro».",
    "Scegli **come** è finito lo scambio: Attacco, Muro, Ace oppure Errore.",
    "Scegli **chi**: il numero di maglia (o «Non so»). Il punteggio, i set e la battuta li calcola lo Scout.",
  ]);
  report.spacer(4);
  report.heading("Come usare questo manuale");
  report.bullets([
    "Se è la **prima volta**, leggi i capitoli da 1 a 5: bastano una decina di minuti e dopo sai segnare una partita.",
    "**Durante la partita** ti basta la **scheda rapida** (ultimo capitolo): stampala e tienila sul tavolo.",
    "Per qualsiasi dubbio c'è l'**indice**, e il **glossario** spiega le parole della pallavolo.",
    "Dentro l'area riservata trovi anche la **guida passo passo**: il punto interrogativo in alto a destra di ogni pagina dello Scout.",
  ]);

  // L'indice sta nella pagina dopo la copertina; si riempie alla fine, quando si sanno i numeri di pagina.
  report.pageBreak();
  const tocPage = report.currentPageIndex;

  const entries: TocEntry[] = [];
  const images: ImageCache = new Map();
  let number = 0;
  for (const chapter of SCOUT_MANUAL) {
    number += 1;
    report.chapter(number, chapter.title, chapter.summary);
    entries.push({ chapter, number, page: report.currentPageIndex + 1 });
    const ctx: RenderContext = { report, blocks: chapter.blocks, images };
    for (let index = 0; index < chapter.blocks.length; index++) await renderBlock(ctx, index);
  }

  report.drawOnPage(tocPage, (canvas) => drawToc(canvas, entries));
  return report.finish();
}

/** Il manuale è lo stesso per tutti: per non rifarlo a ogni download lo si tiene in memoria fino a fine giornata (riporta la data di oggi). */
let cached: { day: string; bytes: Uint8Array } | null = null;

export async function getScoutManualPdf(): Promise<Uint8Array> {
  const day = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
  if (!cached || cached.day !== day) cached = { day, bytes: await buildScoutManualPdf() };
  return cached.bytes;
}
