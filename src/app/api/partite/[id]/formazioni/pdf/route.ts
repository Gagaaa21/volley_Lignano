import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { getRepo } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { CATEGORY_LABELS } from "@/lib/category";
import { formatDateLong } from "@/lib/format";
import { emptyMatchLineupSets, VOLLEY_ROLE_LABELS } from "@/lib/types";
import type { Athlete, CourtPosition } from "@/lib/types";

const FONTS_DIR = path.join(process.cwd(), "src/assets/fonts");

const SEA = rgb(0x14 / 255, 0x54 / 255, 0x70 / 255);
const SAND = rgb(0xb8 / 255, 0x71 / 255, 0x21 / 255);
const INK = rgb(0.06, 0.12, 0.16);
const GREY = rgb(0.45, 0.5, 0.53);
const LINE_GREY = rgb(0.82, 0.85, 0.87);

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;

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

/** Riduce la dimensione del font finché il testo entra in maxWidth (minimo 7pt). */
function fitSize(font: PDFFont, text: string, maxWidth: number, startSize: number): number {
  let size = startSize;
  while (size > 7 && font.widthOfTextAtSize(text, size) > maxWidth) size -= 0.5;
  return size;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return new NextResponse("Non autorizzato.", { status: 401 });
  }

  const { id } = await params;
  const repo = await getRepo();
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
  doc.setTitle(`Formazioni vs ${match.opponent}`);
  doc.setSubject("Riservato allo staff Volley Lignano");
  // I font standard (Helvetica) usano l'encoding WinAnsi e vanno in errore su
  // caratteri accentati o virgolette tipografiche nei nomi/luoghi inseriti
  // dallo staff: qui incorporiamo Liberation Sans (copertura Unicode/Latin
  // Extended completa) invece dei 14 font base di PDF.
  const [regularBytes, boldBytes] = await Promise.all([
    readFile(path.join(FONTS_DIR, "LiberationSans-Regular.ttf")),
    readFile(path.join(FONTS_DIR, "LiberationSans-Bold.ttf")),
  ]);
  const fontRegular = await doc.embedFont(regularBytes, { subset: true });
  const fontBold = await doc.embedFont(boldBytes, { subset: true });

  const dateLabel = formatDateLong(match.matchDate.slice(0, 10));
  const timeLabel = match.matchDate.slice(11, 16);
  const generatedAt = new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });

  for (let setIndex = 0; setIndex < 5; setIndex++) {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    const setLineup = sets[setIndex] ?? [];

    let y = PAGE_H - MARGIN;

    page.drawText("Volley Lignano", { x: MARGIN, y: y - 16, size: 18, font: fontBold, color: SEA });
    page.drawText("Riservato allo staff — formazione di gara", {
      x: MARGIN,
      y: y - 32,
      size: 9,
      font: fontRegular,
      color: GREY,
    });

    y -= 60;
    page.drawText(
      `${CATEGORY_LABELS[match.category]} · ${match.isHome ? "Casa" : "Trasferta"} · vs ${match.opponent}`,
      { x: MARGIN, y, size: 14, font: fontBold, color: INK },
    );
    y -= 18;
    page.drawText(`${dateLabel} · ${timeLabel} · ${match.location}`, {
      x: MARGIN,
      y,
      size: 10,
      font: fontRegular,
      color: GREY,
    });

    y -= 34;
    page.drawText(`SET ${setIndex + 1}`, { x: MARGIN, y, size: 20, font: fontBold, color: SAND });

    const courtWidth = PAGE_W - MARGIN * 2;
    const courtHeight = 320;
    const courtTop = y - 22;
    const courtBottom = courtTop - courtHeight;
    const colWidth = courtWidth / 3;
    const rowHeight = courtHeight / 2;

    centeredText(page, "RETE", MARGIN + courtWidth / 2, courtTop + 8, fontBold, 10, SEA);
    page.drawLine({
      start: { x: MARGIN, y: courtTop },
      end: { x: MARGIN + courtWidth, y: courtTop },
      thickness: 2.5,
      color: SEA,
      dashArray: [5, 3],
    });

    page.drawRectangle({
      x: MARGIN,
      y: courtBottom,
      width: courtWidth,
      height: courtHeight,
      borderColor: SEA,
      borderWidth: 1.5,
    });

    for (const { position, col, row } of CELLS) {
      const cellX = MARGIN + col * colWidth;
      const cellY = courtTop - (row + 1) * rowHeight;
      const centerX = cellX + colWidth / 2;

      if (col > 0) {
        page.drawLine({
          start: { x: cellX, y: cellY },
          end: { x: cellX, y: cellY + rowHeight },
          thickness: 1,
          color: LINE_GREY,
        });
      }
      if (row > 0) {
        page.drawLine({
          start: { x: cellX, y: cellY + rowHeight },
          end: { x: cellX + colWidth, y: cellY + rowHeight },
          thickness: 1,
          color: LINE_GREY,
        });
      }

      page.drawText(String(position), { x: cellX + 8, y: cellY + rowHeight - 16, size: 9, font: fontRegular, color: GREY });

      const slot = setLineup.find((s) => s.position === position);
      const athlete = slot?.athleteId ? athletesById.get(slot.athleteId) : undefined;

      if (athlete) {
        const nameMaxWidth = colWidth - 20;
        const nameSize = fitSize(fontBold, athlete.fullName, nameMaxWidth, 12);
        centeredText(page, athlete.fullName, centerX, cellY + rowHeight / 2 + 6, fontBold, nameSize);

        if (slot?.role) {
          const roleLabel = `${slot.role} · ${VOLLEY_ROLE_LABELS[slot.role]}`;
          const roleSize = fitSize(fontRegular, roleLabel, nameMaxWidth, 8.5);
          centeredText(page, roleLabel, centerX, cellY + rowHeight / 2 - 10, fontRegular, roleSize, GREY);
        }
        if (slot?.isCaptain) {
          centeredText(page, "CAPITANA", centerX, cellY + 12, fontBold, 8, SAND);
        }
      } else {
        centeredText(page, "—", centerX, cellY + rowHeight / 2 - 4, fontRegular, 16, LINE_GREY);
      }
    }

    centeredText(page, "Fondo campo", MARGIN + courtWidth / 2, courtBottom - 16, fontRegular, 9, GREY);

    page.drawText(`Generato il ${generatedAt} · documento riservato allo staff`, {
      x: MARGIN,
      y: MARGIN - 22,
      size: 8,
      font: fontRegular,
      color: GREY,
    });
  }

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
