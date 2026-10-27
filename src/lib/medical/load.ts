import type { Repo } from "@/lib/db/repo";
import { isAppSettingsMissing } from "@/lib/availability/missing";
import type { MedicalCertificate } from "./certificate";

/** I certificati di tutte le atlete, per atleta; null se manca la tabella delle impostazioni (lo spiega l'avviso del database). */
export async function loadCertificates(repo: Repo): Promise<Map<string, MedicalCertificate> | null> {
  try {
    const certificates = await repo.listMedicalCertificates();
    return new Map(certificates.map((certificate) => [certificate.athleteId, certificate] as const));
  } catch (error) {
    if (isAppSettingsMissing(error)) return null;
    throw error;
  }
}
