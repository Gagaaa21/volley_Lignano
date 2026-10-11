import { getScoutManualPdf } from "@/lib/pdf/scoutManualPdf";
import { pdfFilename, pdfResponse } from "@/lib/pdf/report";
import { requireScoutPermission } from "@/lib/scout/access";

/** Manuale d'uso dello Scout in PDF, per chi ha il permesso «Scout»: si scarica, o si manda come file dal pulsante «Condividi PDF». */
export async function GET() {
  const access = await requireScoutPermission();
  if (!access.ok) return access.response;

  return pdfResponse(await getScoutManualPdf(), pdfFilename("Volley Lignano Scout manuale d'uso"), { cache: "private, max-age=600" });
}
