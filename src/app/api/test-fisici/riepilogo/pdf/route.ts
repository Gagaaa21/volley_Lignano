import { getActiveRepo } from "@/lib/db";
import { requireStaffPage, resolveActiveTeam } from "@/lib/auth/guard";
import { buildPhysicalTestsPdf } from "@/lib/pdf/physicalTestsPdf";
import { pdfFilename, pdfResponse } from "@/lib/pdf/report";
import { buildOverviewAthletes, parseTableParams } from "@/lib/physicalTestTable";

/** Riepilogo test fisici in PDF, con la vista, il giorno, i filtri e l'ordine
 * scelti nella pagina (arrivano come parametri dell'indirizzo, tutti verificati). */
export async function GET(request: Request) {
  const session = await requireStaffPage("testfisici");
  const team = await resolveActiveTeam(session);
  const params = parseTableParams(new URL(request.url).searchParams);

  const repo = await getActiveRepo();
  const [tests, athletes] = await Promise.all([repo.listPhysicalTests({ team }), repo.listAthletes({ team })]);
  const bytes = await buildPhysicalTestsPdf({ team, athletes: buildOverviewAthletes(tests, athletes), params });

  const suffix = params.view === "giorno" && params.day ? params.day : params.view;
  return pdfResponse(bytes, pdfFilename(`test fisici ${suffix}`));
}
