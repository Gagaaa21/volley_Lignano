import { getScoutManualPdf } from "@/lib/pdf/scoutManualPdf";
import { pdfFilename, pdfResponse } from "@/lib/pdf/report";

/**
 * Il manuale d'uso dello Scout in PDF, da condividere con un link (nessun
 * accesso): spiega come si usa lo Scout, con schermate fatte su dati di prova,
 * quindi non c'è niente di riservato. Si apre nel browser (e dal telefono nel
 * lettore PDF); i motori di ricerca non lo indicizzano. Il pulsante «Condividi»
 * dell'area riservata manda proprio questo indirizzo.
 */
export async function GET() {
  return pdfResponse(await getScoutManualPdf(), pdfFilename("Volley Lignano Scout manuale d'uso"), {
    cache: "public, max-age=0, s-maxage=3600",
    disposition: "inline",
    headers: { "X-Robots-Tag": "noindex, nofollow" },
  });
}
