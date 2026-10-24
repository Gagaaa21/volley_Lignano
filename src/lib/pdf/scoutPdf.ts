import { matchTitle } from "@/lib/calendar";
import { PdfReport } from "@/lib/pdf/report";
import { addSheetPages } from "@/lib/pdf/scoutSheetPdf";
import { deriveScout } from "@/lib/scout/derive";
import { buildSheet } from "@/lib/scout/sheet";
import type { ScoutData } from "@/lib/scout/types";
import type { Match } from "@/lib/types";

/**
 * Il tabellino di una partita in PDF: solo il foglio come quelli delle leghe, in A4 verticale (src/lib/pdf/scoutSheetPdf.ts),
 * sempre su tutta la partita; con rose lunghissime continua su una seconda pagina. Le analisi restano nella pagina «Tabellino».
 */

export interface ScoutPdfInput {
  match: Match;
  scout: ScoutData;
}

export async function buildScoutPdf({ match, scout }: ScoutPdfInput): Promise<Uint8Array> {
  const view = deriveScout(scout);
  const report = await PdfReport.create({
    title: `Tabellino ${matchTitle(match)}`,
    footerLabel: "Volley Lignano · scout, riservato allo staff",
    orientation: "portrait",
    drawnOnly: true,
  });
  addSheetPages(report, buildSheet(scout, view), match, view.decided || scout.finished);
  return report.finish();
}
