import { getActiveRepo } from "@/lib/db";
import { requireStaffPage, resolveActiveTeam } from "@/lib/auth/guard";
import { buildMatchesPdf, matchesPdfTitle } from "@/lib/pdf/matchesPdf";
import { pdfFilename, pdfResponse } from "@/lib/pdf/report";
import type { Category } from "@/lib/types";

/** PDF delle partite per lo staff (Partite → «Esporta PDF»): come quello
 * pubblico, in più «da inserire» dove manca il risultato.
 * Rispetta la categoria scelta nell'elenco (`?cat=U14` / `?cat=U15`). */
export async function GET(request: Request) {
  const session = await requireStaffPage("partite");
  const team = await resolveActiveTeam(session);
  const cat = new URL(request.url).searchParams.get("cat");
  const category: Category | null = team === "u14u15" && (cat === "U14" || cat === "U15") ? cat : null;

  const repo = await getActiveRepo();
  const matches = await repo.listMatches({ team, category: category ?? undefined });
  const bytes = await buildMatchesPdf({ matches, audience: "staff", category });

  return pdfResponse(bytes, pdfFilename(`${matchesPdfTitle(category)} staff volley lignano`));
}
