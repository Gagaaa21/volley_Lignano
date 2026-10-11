import { buildScoutManualPdf } from "@/lib/pdf/scoutManualPdf";
import { pdfFilename, pdfResponse } from "@/lib/pdf/report";
import { requireScoutPermission } from "@/lib/scout/access";

/** Il manuale è lo stesso per tutti: per non rifarlo a ogni download lo si tiene in memoria fino a fine giornata (riporta la data di oggi). */
let cached: { day: string; bytes: Uint8Array } | null = null;

/** Manuale d'uso dello Scout in PDF, per chi ha il permesso «Scout». */
export async function GET() {
  const access = await requireScoutPermission();
  if (!access.ok) return access.response;

  const day = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
  if (!cached || cached.day !== day) {
    cached = { day, bytes: await buildScoutManualPdf() };
  }
  return pdfResponse(cached.bytes, pdfFilename("Volley Lignano Scout manuale d'uso"), { cache: "private, max-age=600" });
}
