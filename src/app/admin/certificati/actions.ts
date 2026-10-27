"use server";

import { revalidatePath } from "next/cache";
import { getActiveRepo } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guard";
import { isAppSettingsMissing } from "@/lib/availability/missing";
import type { CertificateSaveResult } from "@/lib/medical/certificate";
import { removeCertificatePhoto, saveCertificateFromForm } from "@/lib/medical/save";
import { todayIso } from "@/lib/today";

/**
 * Il certificato medico scritto dallo staff (permesso «Certificati medici»): il giorno della visita e, se c'è, la foto, al posto del
 * genitore o per correggerli. Solo per un'atleta attiva di U14/U15; chi li scrive resta segnato con il suo account e si vede con il
 * suo nome.
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

/** Il giorno della visita (la scadenza viene da sé, un anno dopo) e, se c'è, la foto («issuedOn» e «photo» nel modulo). */
export async function saveStaffCertificateAction(athleteId: string, formData: FormData): Promise<CertificateSaveResult> {
  const session = await requireStaffPage("certificati");
  const target = await activeAthlete(athleteId);
  if (!target) return { ok: false, error: "Atleta non trovata." };
  try {
    const result = await saveCertificateFromForm(target.repo, target.athlete.id, formData, { by: "staff", updatedBy: session.sub }, todayIso());
    if (result.ok) revalidate();
    return result;
  } catch (error) {
    if (isAppSettingsMissing(error)) return { ok: false, error: NO_TABLE };
    throw error;
  }
}

/** Toglie solo la foto: il giorno della visita resta. */
export async function removeStaffCertificatePhotoAction(formData: FormData): Promise<void> {
  await requireStaffPage("certificati");
  const target = await activeAthlete(formData.get("athleteId"));
  if (!target) return;
  try {
    await removeCertificatePhoto(target.repo, target.athlete.id);
  } catch (error) {
    if (!isAppSettingsMissing(error)) throw error;
  }
  revalidate();
}

/** Toglie la data e la foto (per esempio scritte per l'atleta sbagliata): il certificato torna «da inserire». */
export async function clearStaffCertificateAction(formData: FormData): Promise<void> {
  await requireStaffPage("certificati");
  const target = await activeAthlete(formData.get("athleteId"));
  if (!target) return;
  try {
    await target.repo.deleteCertificatePhoto(target.athlete.id).catch(() => undefined);
    await target.repo.clearMedicalCertificate(target.athlete.id);
  } catch (error) {
    if (!isAppSettingsMissing(error)) throw error;
  }
  revalidate();
}
