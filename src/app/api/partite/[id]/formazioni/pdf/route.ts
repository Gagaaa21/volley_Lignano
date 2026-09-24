import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { getActiveRepo } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { matchTitle } from "@/lib/calendar";
import { CATEGORY_LABELS } from "@/lib/category";
import { formatDateLong } from "@/lib/format";
import { emptyMatchLineupSets, emptySetLineup } from "@/lib/types";
import type { Athlete, CourtPosition, SetLineup } from "@/lib/types";

const FONTS_DIR = path.join(process.cwd(), "src/assets/fonts");

const SEA = rgb(0x14 / 255, 0x54 / 255, 0x70 / 255);
const SAND = rgb(0xb8 / 255, 0x71 / 255, 0x21 / 255);
const INK = rgb(0.06, 0.12, 0.16);
const GREY = rgb(0.45, 0.5, 0.53);
const LINE_GREY = rgb(0.82, 0.85, 0.87);

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;

/** Al massimo 5 set: le formazioni stanno tutte su un'unica pagina, invece di
 * una pagina intera per set. Blocchi a dimensione fissa (anche con meno di 5
 * set giocati) per un impaginato prevedibile. */
const MAX_SETS = 5;
const BLOCK_GAP = 10;
const FOOTER_RESERVE = 40;

/** Fila avanti (vicino alla rete) poi fila arretrata, col da sinistra a destra. */
const CELLS: { position: CourtPosition; col: number; row: number }[] = [
  { position: 4, col: 0, row: 0 },
  { position: 3, col: 1, row: 0 },
  { position: 2, col: 2, row: 0 },
  { position: 5, col: 0, row: 1 },
  { position: 6, col: 1, row: 1 },
  { position: 1, col: 2, row: 1 },
];

function centeredText(
  page: PDFPage,
  text: string,
  centerX: number,
  y: number,
  font: PDFFont,
  size: number,
  color = INK,
) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: centerX - width / 2, y, size, font, color });
}

/** Riduce la dimensione del font finché il testo entra in maxWidth (minimo 6pt). */
function fitSize(font: PDFFont, text: string, maxWidth: number, startSize: number): number {
  let size = startSize;
  while (size > 6 && font.widthOfTextAtSize(text, size) > maxWidth) size -= 0.5;
  return size;
}

/** Spezza il testo su più righe (max maxLines) perché entri in maxWidth;
 * l'ultima riga viene troncata con "…" solo se resta testo non mostrato. */
function wrapText(font: PDFFont, text: string, maxWidth: number, size: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  let i = 0;
  while (i < words.length) {
    const word = words[i];
    const candidate = current ? `${current} ${word}` : word;
    if (!current || font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      i++;
    } else {
      lines.push(current);
      current = "";
      if (lines.length === maxLines) break;
    }
  }

  const hasLeftover = i < words.length;
  if (lines.length < maxLines) {
    if (current) lines.push(current);
  } else if (hasLeftover && lines.length > 0) {
    let last = lines[lines.length - 1];
    while (last.length > 0 && font.widthOfTextAtSize(`${last}…`, size) > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[lines.length - 1] = `${last}…`;
  }
  return lines;
}

/** Disegna un campo compatto (griglia 3x2) con la formazione di un set,
 * dentro il riquadro [originX, blockTop] largo `width` e alto `height`. */
function drawSetBlock(
  page: PDFPage,
  fonts: { regular: PDFFont; bold: PDFFont },
  originX: number,
  blockTop: number,
  width: number,
  height: number,
  setNumber: number,
  setLineup: SetLineup,
  athletesById: Map<string, Athlete>,
) {
  const { regular: fontRegular, bold: fontBold } = fonts;

  page.drawText(`SET ${setNumber}`, { x: originX, y: blockTop - 11, size: 11, font: fontBold, color: SAND });

  const liberoNames = setLineup.liberoIds
    .map((id) => (id ? athletesById.get(id)?.fullName : null))
    .filter((name): name is string => Boolean(name));
  if (liberoNames.length > 0) {
    const label = `Libero: ${liberoNames.join(", ")}`;
    const rightX = originX + width;
    const labelSize = fitSize(fontRegular, label, width * 0.55, 8.5);
    const labelWidth = fontRegular.widthOfTextAtSize(label, labelSize);
    page.drawText(label, {
      x: rightX - labelWidth,
      y: blockTop - 10,
      size: labelSize,
      font: fontRegular,
      color: GREY,
    });
  }

  const gridHeight = height - 18;
  const gridTop = blockTop - 18;
  const gridBottom = gridTop - gridHeight;
  const colWidth = width / 3;
  const rowHeight = gridHeight / 2;

  page.drawRectangle({
    x: originX,
    y: gridBottom,
    width,
    height: gridHeight,
    borderColor: SEA,
    borderWidth: 1.2,
  });

  for (const { position, col, row } of CELLS) {
    const cellX = originX + col * colWidth;
    const cellY = gridTop - (row + 1) * rowHeight;
    const centerX = cellX + colWidth / 2;

    if (col > 0) {
      page.drawLine({
        start: { x: cellX, y: cellY },
        end: { x: cellX, y: cellY + rowHeight },
        thickness: 0.75,
        color: LINE_GREY,
      });
    }
    if (row > 0) {
      page.drawLine({
        start: { x: cellX, y: cellY + rowHeight },
        end: { x: cellX + colWidth, y: cellY + rowHeight },
        thickness: 0.75,
        color: LINE_GREY,
      });
    }

    page.drawText(String(position), { x: cellX + 4, y: cellY + rowHeight - 9, size: 6.5, font: fontRegular, color: GREY });

    const slot = setLineup.slots.find((s) => s.position === position);
    const athlete = slot?.athleteId ? athletesById.get(slot.athleteId) : undefined;

    if (athlete) {
      const nameMaxWidth = colWidth - 10;
      const metaParts = [slot?.role, slot?.isCaptain ? "C" : null].filter(Boolean) as string[];
      const hasMeta = metaParts.length > 0;
      const nameSize = fitSize(fontBold, athlete.fullName, nameMaxWidth, 9.5);
      centeredText(page, athlete.fullName, centerX, cellY + rowHeight / 2 + (hasMeta ? 3 : -2), fontBold, nameSize);

      if (hasMeta) {
        const metaLabel = metaParts.join(" · ");
        centeredText(page, metaLabel, centerX, cellY + rowHeight / 2 - 9, fontRegular, 7, slot?.isCaptain ? SAND : GREY);
      }
    } else {
      centeredText(page, "—", centerX, cellY + rowHeight / 2 - 3, fontRegular, 11, LINE_GREY);
    }
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return new NextResponse("Non autorizzato.", { status: 401 });
  }

  const { id } = await params;
  const repo = await getActiveRepo();
  const [match, lineup, allAthletes] = await Promise.all([
    repo.getMatch(id),
    repo.getMatchLineup(id),
    repo.listAthletes(),
  ]);
  if (!match) {
    return new NextResponse("Partita non trovata.", { status: 404 });
  }

  const athletesById = new Map<string, Athlete>(allAthletes.map((a) => [a.id, a] as const));
  const sets = lineup?.sets ?? emptyMatchLineupSets();

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`Formazioni ${matchTitle(match)}`);
  doc.setSubject("Riservato allo staff Volley Lignano");
  // I font standard (Helvetica) usano l'encoding WinAnsi e vanno in errore su
  // caratteri accentati o virgolette tipografiche nei nomi/luoghi inseriti
  // dallo staff: qui incorporiamo Liberation Sans (copertura Unicode/Latin
  // Extended completa) invece dei 14 font base di PDF. I file in
  // src/assets/fonts sono già ridotti ai soli caratteri Latin-1 (lettere
  // accentate italiane comprese) e senza hinting: il font "intero" pesa
  // ~400KB, questa versione ~15KB, e insieme a subset:true (che incorpora
  // solo i glifi davvero usati in ogni singolo PDF) tiene il file leggero.
  const [regularBytes, boldBytes] = await Promise.all([
    readFile(path.join(FONTS_DIR, "LiberationSans-Regular.ttf")),
    readFile(path.join(FONTS_DIR, "LiberationSans-Bold.ttf")),
  ]);
  const fontRegular = await doc.embedFont(regularBytes, { subset: true });
  const fontBold = await doc.embedFont(boldBytes, { subset: true });

  const dateLabel = formatDateLong(match.matchDate.slice(0, 10));
  const timeLabel = match.matchDate.slice(11, 16);
  const generatedAt = new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });

  // Salta i set senza nessuna giocatrice assegnata (spesso una partita finisce
  // prima del quinto set). Se non è stata inserita nessuna formazione, mostra
  // comunque il primo campo vuoto invece di un PDF senza contenuto.
  const setIndexesWithLineup = sets
    .map((set, index) => ({ set, index }))
    .filter(({ set }) => set.slots.some((slot) => slot.athleteId) || set.liberoIds.some(Boolean))
    .map(({ index }) => index);
  const setIndexesToRender = setIndexesWithLineup.length > 0 ? setIndexesWithLineup : [0];

  const page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  page.drawText("Volley Lignano", { x: MARGIN, y: y - 16, size: 18, font: fontBold, color: SEA });
  page.drawText("Riservato allo staff — formazioni di gara", {
    x: MARGIN,
    y: y - 30,
    size: 9,
    font: fontRegular,
    color: GREY,
  });

  const courtWidth = PAGE_W - MARGIN * 2;

  y -= 52;
  page.drawText(
    `${CATEGORY_LABELS[match.category]} · ${match.isHome ? "Casa" : "Trasferta"} · ${matchTitle(match)}` +
      (match.isFriendly ? " · Amichevole" : "") +
      (match.isTournament ? " · Torneo" : ""),
    { x: MARGIN, y, size: 13, font: fontBold, color: INK },
  );
  y -= 16;
  page.drawText(`${dateLabel} · ${timeLabel} · ${match.location}`, {
    x: MARGIN,
    y,
    size: 9,
    font: fontRegular,
    color: GREY,
  });

  if (match.meetingTime || match.meetingLocation) {
    y -= 14;
    const meetingParts = [
      match.meetingTime ? `ore ${match.meetingTime}` : null,
      match.meetingLocation,
    ].filter(Boolean);
    page.drawText(`Ritrovo: ${meetingParts.join(" · ")}`, {
      x: MARGIN,
      y,
      size: 9,
      font: fontRegular,
      color: GREY,
    });
  }

  if (match.resultSetsWon !== null && match.resultSetsLost !== null) {
    y -= 14;
    const outcome = match.resultSetsWon > match.resultSetsLost ? "Vittoria" : "Sconfitta";
    const setsLabel = `${match.resultSetsWon}-${match.resultSetsLost}`;
    const partial = match.setScores?.length
      ? ` (${match.setScores.map((s) => `${s.us}-${s.them}`).join(", ")})`
      : "";
    page.drawText(`Risultato: ${outcome} ${setsLabel}${partial}`, {
      x: MARGIN,
      y,
      size: 9,
      font: fontBold,
      color: match.resultSetsWon > match.resultSetsLost ? SEA : rgb(0.6, 0.15, 0.15),
    });
  }

  if (match.calledUpAthleteIds.length > 0) {
    const names = match.calledUpAthleteIds
      .map((id) => athletesById.get(id)?.fullName)
      .filter((name): name is string => Boolean(name));
    if (names.length > 0) {
      y -= 14;
      const wrapped = wrapText(fontRegular, `Convocate: ${names.join(", ")}`, courtWidth, 8.5, 2);
      for (const line of wrapped) {
        page.drawText(line, { x: MARGIN, y, size: 8.5, font: fontRegular, color: GREY });
        y -= 11;
      }
    }
  }

  y -= 20;
  page.drawText("Fila superiore = vicino alla rete · fila inferiore = fondo campo", {
    x: MARGIN,
    y,
    size: 8,
    font: fontRegular,
    color: GREY,
  });
  const blocksTop = y - 14;
  const blocksBottom = MARGIN + FOOTER_RESERVE;
  const availableHeight = blocksTop - blocksBottom;
  const blockHeight = (availableHeight - BLOCK_GAP * (MAX_SETS - 1)) / MAX_SETS;

  setIndexesToRender.forEach((setIndex, renderIdx) => {
    const blockTop = blocksTop - renderIdx * (blockHeight + BLOCK_GAP);
    drawSetBlock(
      page,
      { regular: fontRegular, bold: fontBold },
      MARGIN,
      blockTop,
      courtWidth,
      blockHeight,
      setIndex + 1,
      sets[setIndex] ?? emptySetLineup(),
      athletesById,
    );
  });

  page.drawText(`Generato il ${generatedAt} · documento riservato allo staff`, {
    x: MARGIN,
    y: MARGIN - 12,
    size: 8,
    font: fontRegular,
    color: GREY,
  });

  const pdfBytes = await doc.save();
  const safeOpponent = match.opponent.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const filename = `formazioni-${safeOpponent || "partita"}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
