import { NextResponse } from "next/server";
import { buildScoutPdf } from "@/lib/pdf/scoutPdf";
import { pdfFilename, pdfResponse } from "@/lib/pdf/report";
import { summarizeScout } from "@/lib/scout/match";
import { requireScoutAccess, withScoutStore } from "@/lib/scout/access";

/** Tabellino dello scout in PDF. `?set=2` per un solo set, altrimenti tutta la partita. */
export async function GET(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const access = await requireScoutAccess(matchId);
  if (!access.ok) return access.response;

  const scout = await withScoutStore(() => access.repo.getMatchScout(matchId));
  if (scout instanceof NextResponse) return scout;
  if (!scout || summarizeScout(scout).state === "none") {
    return NextResponse.json({ error: "Non ci sono ancora punti segnati per questa partita." }, { status: 404 });
  }

  const setParam = Number(new URL(request.url).searchParams.get("set"));
  const bytes = await buildScoutPdf({
    match: access.match,
    scout,
    set: Number.isInteger(setParam) && setParam > 0 ? setParam : null,
  });
  const { match } = access;
  return pdfResponse(bytes, pdfFilename(`tabellino ${match.opponent} ${match.matchDate.slice(0, 10)}`));
}
