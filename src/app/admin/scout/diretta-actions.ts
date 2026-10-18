"use server";

import { revalidatePath } from "next/cache";
import { requireStaffPage } from "@/lib/auth/guard";
import { getRepo } from "@/lib/db";
import { buildStreamSettings, LIVE_STREAM_KEY, MAX_CAMERAS } from "@/lib/diretta/streams";

export interface DirettaState {
  error?: string;
  success?: string;
}

/**
 * Salva (o svuota) i link delle dirette YouTube che i genitori guardano da /diretta. Riservata a chi ha il permesso «Scout».
 * Non in «Modalità prova»: la pagina dei genitori legge l'archivio vero, e un link di prova ci finirebbe davvero.
 */
export async function saveLiveStreamAction(_previous: DirettaState, formData: FormData): Promise<DirettaState> {
  const session = await requireStaffPage("scout");
  if (session.testMode) return { error: "In «Modalità prova» i link non si salvano: esci dalla modalità prova e riprova." };
  try {
    const repo = await getRepo();
    if (formData.get("intent") === "clear") {
      await repo.setAppSetting(LIVE_STREAM_KEY, "");
      revalidatePath("/admin/scout");
      return { success: "Diretta svuotata: ai genitori compare «La diretta non è ancora iniziata»." };
    }
    const fields = Array.from({ length: MAX_CAMERAS }, (_, index) => ({
      name: String(formData.get(`name${index}`) ?? ""),
      link: String(formData.get(`link${index}`) ?? ""),
    }));
    const built = buildStreamSettings(fields, String(formData.get("delay") ?? ""));
    if (!built.ok) return { error: built.error };
    await repo.setAppSetting(LIVE_STREAM_KEY, JSON.stringify(built.settings));
    revalidatePath("/admin/scout");
    const count = built.settings.cameras.length;
    return { success: `Salvato: ${count === 1 ? "1 camera" : `${count} camere`}. I genitori le trovano su /diretta.` };
  } catch (error) {
    console.error("[saveLiveStreamAction]", error);
    return { error: "Non è stato possibile salvare. Riprova." };
  }
}
