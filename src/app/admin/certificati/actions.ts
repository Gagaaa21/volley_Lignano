"use server";

import { revalidatePath } from "next/cache";
import { getActiveRepo } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guard";
import { isAppSettingsMissing } from "@/lib/availability/missing";
import { certificateFromInput, type CertificateSaveResult } from "@/lib/medical/certificate";
import { todayIso } from "@/lib/today";

/**
 * Le date del certificato medico scritte dallo staff (permesso «Certificati medici»): al posto del genitore, o per correggerle.
 * Solo per un'atleta attiva di U14/U15; chi le scrive resta segnato con il suo account e si vede con il suo nome.
 */

const NO_TABLE = "Manca la tabella delle impostazioni nel database: va eseguito l'aggiornamento (vedi l'avviso in cima alla pagina).";

async function activeAthlete(athleteId: unknown) {
  const id = typeof athleteId === "string" ? athleteId.trim().slice(0, 100) : "";
  const repo = await getActiveRepo();
  const athlete = id ? await repo.getAthlete(id) : null;
  return athlete && athlete.team === "u14u15" && athlete.isActive ? { repo, athlete } : null;
}

function revalidate() {
  revalidatePath("/admin/certificati");
  // Il riquadro dei certificati da sistemare in dashboard.
  revalidatePath("/admin");
}

export async function saveStaffCertificateAction(athleteId: string, issuedOn: string, validUntil: string): Promise<CertificateSaveResult> {
  const session = await requireStaffPage("certificati");
  const target = await activeAthlete(athleteId);
  if (!target) return { ok: false, error: "Atleta non trovata." };
  const input = certificateFromInput(issuedOn, validUntil, todayIso());
  if (!input.ok) return input;
  try {
    await target.repo.saveMedicalCertificate({
      athleteId: target.athlete.id,
      issuedOn: input.issuedOn,
      validUntil: input.validUntil,
      by: "staff",
      updatedBy: session.sub,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (isAppSettingsMissing(error)) return { ok: false, error: NO_TABLE };
    throw error;
  }
  revalidate();
  return { ok: true };
}

/** Toglie le date (per esempio scritte per l'atleta sbagliata): il certificato torna «da inserire». */
export async function clearStaffCertificateAction(formData: FormData): Promise<void> {
  await requireStaffPage("certificati");
  const target = await activeAthlete(formData.get("athleteId"));
  if (!target) return;
  try {
    await target.repo.clearMedicalCertificate(target.athlete.id);
  } catch (error) {
    if (!isAppSettingsMissing(error)) throw error;
  }
  revalidate();
}
