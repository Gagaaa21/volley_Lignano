import { NextResponse } from "next/server";
import { pdfFilename, pdfResponse } from "@/lib/pdf/report";
import { buildTripPdf } from "@/lib/pdf/tripPdf";
import { requireTripAccess, withTripStore } from "@/lib/trips/access";
import { emptyTripData } from "@/lib/trips/types";

/**
 * Riepilogo della trasferta in PDF, da mandare alle famiglie. Sezione «super riservata»: serve il permesso «Trasferte»
 * (altrimenti 401/403, mai una pagina di accesso) e il file non resta in nessuna cache. Senza `?numeri=autisti` non ha nessun
 * numero di telefono; con, solo quelli degli autisti.
 */
export async function GET(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const access = await requireTripAccess(matchId);
  if (!access.ok) return access.response;
  const { repo, match } = access;

  const includeDriverNumbers = new URL(request.url).searchParams.get("numeri") === "autisti";
  const bytes = await withTripStore(async () => {
    const [trip, athletes] = await Promise.all([repo.getMatchTrip(matchId), repo.listAthletes({ team: "u14u15" })]);
    return buildTripPdf({ match, data: trip ?? emptyTripData(), athletes, includeDriverNumbers });
  });
  if (bytes instanceof NextResponse) return bytes;

  const filename = pdfFilename(`trasferta ${match.category ?? ""} ${match.opponent} ${match.matchDate.slice(0, 10)}`);
  return pdfResponse(bytes, filename, { cache: "private, no-store" });
}
