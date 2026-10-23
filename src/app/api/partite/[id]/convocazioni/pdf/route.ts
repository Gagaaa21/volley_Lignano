import { NextResponse } from "next/server";
import { getActiveRepo } from "@/lib/db";
import { getOwnStaff } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/session";
import { buildConvocationPdf, resolveConvocatedIds } from "@/lib/pdf/convocationPdf";
import { pdfFilename, pdfResponse } from "@/lib/pdf/report";

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Le convocazioni di una partita in PDF, da mandare a famiglie e atlete. Serve il permesso «Partite» (altrimenti 401/403,
 * mai una pagina di accesso) e il file non resta in nessuna cache. Senza `?ids=` sono le convocate salvate nella partita;
 * con, la selezione che chi prepara il foglio ha in questo momento nella finestra delle convocazioni (anche non ancora salvata),
 * così il PDF è sempre quello che si vede. Gli identificativi sconosciuti o di un'altra squadra si ignorano.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return fail("Sessione scaduta: accedi di nuovo.", 401);

  let allowedTeams: readonly string[] | null = null; // null = il Developer, senza limiti
  if (session.role !== "dev") {
    const staff = await getOwnStaff(session.sub);
    if (!staff || !staff.allowedPages.includes("partite")) return fail("Non hai accesso alle partite.", 403);
    allowedTeams = staff.allowedTeams;
  }

  const { id } = await params;
  const repo = await getActiveRepo();
  const match = await repo.getMatch(id);
  if (!match) return fail("Partita non trovata.", 404);
  if (allowedTeams && !allowedTeams.includes(match.team)) return fail("Non hai accesso a questa squadra.", 403);

  const wanted = resolveConvocatedIds(new URL(request.url).searchParams.get("ids"), match.calledUpAthleteIds);
  const athletes = (await repo.listAthletes({ team: match.team })).filter((athlete) => wanted.has(athlete.id));

  const bytes = await buildConvocationPdf({ match, athletes });
  // Con la categoria e la data: le convocazioni di Under 14 e Under 15 contro la stessa avversaria non hanno lo stesso nome.
  const filename = pdfFilename(`convocazioni ${match.category ?? ""} ${match.opponent} ${match.matchDate.slice(0, 10)}`);
  return pdfResponse(bytes, filename, { cache: "private, no-store" });
}
