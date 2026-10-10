import { getPublicMatches } from "@/lib/publicCalendarData";
import { buildMatchesPdf, matchesPdfTitle } from "@/lib/pdf/matchesPdf";
import { pdfFilename, pdfResponse } from "@/lib/pdf/report";
import type { Category } from "@/lib/types";

/**
 * PDF con tutte le partite, scaricabile dal sito pubblico (nessun accesso):
 * solo ciò che il calendario pubblico già mostra. `?cat=U14` o `?cat=U15`
 * per una sola categoria. Legge dalla stessa cache del sito, quindi un
 * download non pesa sul database; la rete tiene la risposta un minuto.
 */
export async function GET(request: Request) {
  const cat = new URL(request.url).searchParams.get("cat");
  const category: Category | null = cat === "U14" || cat === "U15" ? cat : null;

  const matches = await getPublicMatches(category ?? undefined);
  const bytes = await buildMatchesPdf({ matches, audience: "public", category });

  return pdfResponse(bytes, pdfFilename(`${matchesPdfTitle(category)} volley lignano`), {
    cache: "public, max-age=0, s-maxage=60",
  });
}
