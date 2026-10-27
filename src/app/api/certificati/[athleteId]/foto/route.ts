import { NextResponse } from "next/server";
import { getActiveRepo } from "@/lib/db";
import { getOwnStaff } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/session";
import { isAppSettingsMissing } from "@/lib/availability/missing";
import { sniffImageType } from "@/lib/medical/photo";

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * La foto del certificato medico di un'atleta, per lo staff: serve il permesso «Certificati medici» (il Developer ce l'ha sempre),
 * altrimenti 401/403 e mai una pagina di accesso. È un dato sanitario di una minorenne: non resta in nessuna cache, non si apre
 * dentro altre pagine e non porta con sé nient'altro.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ athleteId: string }> }) {
  const { athleteId } = await params;
  const session = await getSession();
  if (!session) return fail("Sessione scaduta: accedi di nuovo.", 401);
  if (session.role !== "dev") {
    const staff = await getOwnStaff(session.sub);
    if (!staff || !staff.allowedPages.includes("certificati")) return fail("Non hai accesso ai certificati medici.", 403);
    if (!staff.allowedTeams.includes("u14u15")) return fail("Non hai accesso a questa squadra.", 403);
  }

  const repo = await getActiveRepo();
  const athlete = await repo.getAthlete(athleteId.slice(0, 100));
  if (!athlete || athlete.team !== "u14u15") return fail("Atleta non trovata.", 404);
  const certificate = await repo.getMedicalCertificate(athlete.id).catch((error: unknown) => {
    if (isAppSettingsMissing(error)) return null;
    throw error;
  });
  if (!certificate?.photo) return fail("Nessuna foto del certificato.", 404);
  const photo = await repo.getCertificatePhoto(athlete.id);
  if (!photo) return fail("Nessuna foto del certificato.", 404);

  const contentType = sniffImageType(photo.data) ?? certificate.photo.contentType;
  const extension = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  return new Response(Buffer.from(photo.data), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="certificato-medico.${extension}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
      "Referrer-Policy": "no-referrer",
    },
  });
}
