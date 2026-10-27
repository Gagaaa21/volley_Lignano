import "server-only";
import type { Repo } from "@/lib/db/repo";
import { certificateFromInput, type CertificateSaveResult, type MedicalCertificate } from "./certificate";
import { checkPhoto, keepPhoto, type CertificatePhoto, type PhotoType } from "./photo";

/**
 * Il salvataggio del certificato dal modulo, uguale per il genitore e per lo staff (cambia solo chi è l'autore): il giorno della
 * visita e, se c'è, la foto. Una foto nuova sostituisce quella di prima; senza foto nuova quella di prima resta solo se la visita è
 * la stessa (con una visita nuova era del certificato vecchio, e va via). Chi chiama ha già controllato chi è e per quale atleta.
 */
export async function saveCertificateFromForm(
  repo: Repo,
  athleteId: string,
  formData: FormData,
  author: Pick<MedicalCertificate, "by" | "updatedBy">,
  today: string,
): Promise<CertificateSaveResult> {
  const input = certificateFromInput(formData.get("issuedOn"), today);
  if (!input.ok) return input;

  const file = formData.get("photo");
  let upload: { bytes: Uint8Array; contentType: PhotoType } | null = null;
  if (file && typeof file === "object" && "arrayBuffer" in file && file.size > 0) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const check = checkPhoto(bytes);
    if (!check.ok) return check;
    upload = { bytes, contentType: check.contentType };
  }

  const previous = await repo.getMedicalCertificate(athleteId);
  const now = new Date().toISOString();
  let photo: CertificatePhoto | null;
  if (upload) {
    try {
      await repo.saveCertificatePhoto(athleteId, upload.bytes, upload.contentType);
    } catch (error) {
      console.error("Certificati: foto non salvata:", error instanceof Error ? error.message : "errore sconosciuto");
      return { ok: false, error: "Non sono riuscito a salvare la foto: riprova tra poco." };
    }
    photo = { contentType: upload.contentType, size: upload.bytes.length, uploadedAt: now, ...author };
  } else {
    photo = keepPhoto(previous, input.issuedOn);
    if (previous?.photo && !photo) await repo.deleteCertificatePhoto(athleteId).catch(() => undefined);
  }

  await repo.saveMedicalCertificate({ athleteId, issuedOn: input.issuedOn, validUntil: input.validUntil, ...author, updatedAt: now, photo });
  return { ok: true };
}

/** Toglie solo la foto (il giorno della visita resta). */
export async function removeCertificatePhoto(repo: Repo, athleteId: string): Promise<void> {
  const previous = await repo.getMedicalCertificate(athleteId);
  await repo.deleteCertificatePhoto(athleteId).catch(() => undefined);
  if (previous?.photo) await repo.saveMedicalCertificate({ ...previous, photo: null });
}
