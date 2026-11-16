"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireStaffPage } from "@/lib/auth/guard";
import { getRepo } from "@/lib/db";
import {
  CUE_COOLDOWN_MS,
  CUE_META,
  cueSoundKey,
  isCueKind,
  LIVE_CUES_KEY,
  MAX_SOUND_BYTES,
  parseCues,
  soundTypeOf,
  withCue,
  withSound,
} from "@/lib/diretta/cues";

export type CueResult = { ok: true; message: string } | { ok: false; error: string };

const TEST_MODE_ERROR = "In «Modalità prova» la pulsantiera non va in diretta: esci dalla modalità prova e riprova.";

/**
 * Manda in onda una scritta animata (vedi src/lib/diretta/cues.ts): la grafica di Streamlabs / OBS la vede alla prossima
 * lettura, circa un secondo dopo. Riservata a chi ha il permesso «Scout», come la scheda Diretta. Non in «Modalità prova»: la
 * grafica legge l'archivio vero.
 */
export async function sendCueAction(kind: string): Promise<CueResult> {
  const session = await requireStaffPage("scout");
  if (!isCueKind(kind)) return { ok: false, error: "Tasto sconosciuto." };
  if (session.testMode) return { ok: false, error: TEST_MODE_ERROR };
  try {
    const repo = await getRepo();
    const stored = parseCues(await repo.getAppSetting(LIVE_CUES_KEY));
    const now = Date.now();
    // Due tocchi di fila (anche da due tablet) non si accavallano: il secondo aspetta un attimo.
    if (stored.last && now - stored.last.at >= 0 && now - stored.last.at < CUE_COOLDOWN_MS) {
      return { ok: false, error: "Un attimo: è appena partita un'altra scritta." };
    }
    await repo.setAppSetting(LIVE_CUES_KEY, JSON.stringify(withCue(stored, kind, randomUUID(), now)));
    return { ok: true, message: `In onda: ${CUE_META[kind].button}` };
  } catch (error) {
    console.error("[sendCueAction]", error);
    return { ok: false, error: "Non è partita: controlla la connessione e riprova." };
  }
}

/** Carica un file audio al posto del jingle originale di un tasto (mp3, m4a, ogg, wav; al massimo 400 kB). */
export async function uploadCueSoundAction(formData: FormData): Promise<CueResult> {
  const session = await requireStaffPage("scout");
  const kind = String(formData.get("kind") ?? "");
  const file = formData.get("file");
  if (!isCueKind(kind)) return { ok: false, error: "Tasto sconosciuto." };
  if (session.testMode) return { ok: false, error: TEST_MODE_ERROR };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Scegli un file audio." };
  if (file.size > MAX_SOUND_BYTES) return { ok: false, error: `Il file è troppo grande: al massimo ${Math.round(MAX_SOUND_BYTES / 1000)} kB (pochi secondi di audio).` };
  const type = soundTypeOf(file);
  if (!type) return { ok: false, error: "Formato non riconosciuto: usa un file mp3, m4a, ogg o wav." };
  try {
    const data = Buffer.from(await file.arrayBuffer()).toString("base64");
    const repo = await getRepo();
    await repo.setAppSetting(cueSoundKey(kind), JSON.stringify({ type, data }));
    const stored = parseCues(await repo.getAppSetting(LIVE_CUES_KEY));
    await repo.setAppSetting(LIVE_CUES_KEY, JSON.stringify(withSound(stored, kind, Date.now())));
    revalidatePath("/admin/scout/pulsantiera");
    return { ok: true, message: `Suono caricato per «${CUE_META[kind].button}».` };
  } catch (error) {
    console.error("[uploadCueSoundAction]", error);
    return { ok: false, error: "Non è stato possibile caricare il suono. Riprova." };
  }
}

/** Toglie il suono caricato: il tasto torna al jingle originale. */
export async function removeCueSoundAction(kind: string): Promise<CueResult> {
  const session = await requireStaffPage("scout");
  if (!isCueKind(kind)) return { ok: false, error: "Tasto sconosciuto." };
  if (session.testMode) return { ok: false, error: TEST_MODE_ERROR };
  try {
    const repo = await getRepo();
    const stored = parseCues(await repo.getAppSetting(LIVE_CUES_KEY));
    await repo.setAppSetting(LIVE_CUES_KEY, JSON.stringify(withSound(stored, kind, null)));
    await repo.setAppSetting(cueSoundKey(kind), "");
    revalidatePath("/admin/scout/pulsantiera");
    return { ok: true, message: `«${CUE_META[kind].button}» torna al jingle originale.` };
  } catch (error) {
    console.error("[removeCueSoundAction]", error);
    return { ok: false, error: "Non è stato possibile togliere il suono. Riprova." };
  }
}
