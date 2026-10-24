import { NextResponse } from "next/server";
import { buildScoutPdf } from "@/lib/pdf/scoutPdf";
import { pdfFilename, pdfResponse } from "@/lib/pdf/report";
import { CATEGORY_SHORT } from "@/lib/category";
import { summarizeScout } from "@/lib/scout/match";
import { requireScoutAccess, withScoutStore } from "@/lib/scout/access";

/** Tabellino dello scout in PDF: il foglio come quelli delle leghe, sempre su tutta la partita. */
export async function GET(_request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const access = await requireScoutAccess(matchId);
  if (!access.ok) return access.response;

  const scout = await withScoutStore(() => access.repo.getMatchScout(matchId));
  if (scout instanceof NextResponse) return scout;
  if (!scout || summarizeScout(scout).state === "none") {
    return NextResponse.json({ error: "Non ci sono ancora punti segnati per questa partita." }, { status: 404 });
  }

  const bytes = await buildScoutPdf({ match: access.match, scout });
  const { match } = access;
  const category = match.category ? `${CATEGORY_SHORT[match.category]} ` : "";
  return pdfResponse(bytes, pdfFilename(`tabellino ${category}${match.opponent} ${match.matchDate.slice(0, 10)}`));
}
