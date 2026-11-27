"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireStaffPage } from "@/lib/auth/guard";
import { getRepo } from "@/lib/db";
import { ringCue } from "@/lib/diretta/realtimeServer";
import {
  CUE_COOLDOWN_MS,
  CUE_META,
  cueSoundKey,
  defaultSoundUrl,
  isCueKind,
  lastCueOf,
  lastCueValue,
  LIVE_CUE_LAST_KEY,
  LIVE_CUES_KEY,
  MAX_SOUND_BYTES,
  parseCues,
  soundTypeOf,
  withSound,
} from "@/lib/diretta/cues";

export type CueResult = { ok: true; message: string } | { ok: false; error: string };

const TEST_MODE_ERROR = "In «Modalità prova» la pulsantiera non va in diretta: esci dalla modalità prova e riprova.";

/**
 * Manda in onda una scritta animata (vedi src/lib/diretta/cues.ts): la salva e suona il campanello in tempo reale (vedi
 * src/lib/diretta/realtime.ts), così la grafica di Streamlabs / OBS la rilegge subito; se il campanello non arriva, la vede
 * alla lettura successiva. Riservata a chi ha il permesso «Scout», come la scheda Diretta. Non in «Modalità prova»: la
 * grafica legge l'archivio vero.
 */
export async function sendCueAction(kind: string): Promise<CueResult> {
  const session = await requireStaffPage("scout");
  if (!isCueKind(kind)) return { ok: false, error: "Tasto sconosciuto." };
  if (session.testMode) return { ok: false, error: TEST_MODE_ERROR };
  try {
    const repo = await getRepo();
    const settings = await repo.getAppSettings([LIVE_CUES_KEY, LIVE_CUE_LAST_KEY]);
    const last = lastCueOf(parseCues(settings[LIVE_CUES_KEY] ?? null), settings[LIVE_CUE_LAST_KEY] ?? null);
    const now = Date.now();
    // Due tocchi di fila (anche da due tablet) non si accavallano: il secondo aspetta un attimo.
    if (last && now - last.at >= 0 && now - last.at < CUE_COOLDOWN_MS) {
      return { ok: false, error: "Un attimo: è appena partita un'altra scritta." };
    }
    const id = randomUUID();
    // Solo la sua chiave: i suoni (LIVE_CUES_KEY) non si toccano, così un caricamento in corso non si perde e non cancella il tocco.
    await repo.setAppSetting(LIVE_CUE_LAST_KEY, lastCueValue(kind, id, now));
    await ringCue(id);
    return { ok: true, message: `In onda: ${CUE_META[kind].button}` };
  } catch (error) {
    console.error("[sendCueAction]", error);
    return { ok: false, error: "Non è partita: controlla la connessione e riprova." };
  }
}

/** Carica un file audio per un tasto, al posto del suono di partenza o dove non c'è (mp3, m4a, ogg, wav; al massimo 400 kB). */
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
    // La stessa versione nel file e nell'elenco dei suoni: l'indirizzo del suono la porta, e la rete tiene solo quella giusta.
    const version = Date.now();
    await repo.setAppSetting(cueSoundKey(kind), JSON.stringify({ type, data, version }));
    const stored = parseCues(await repo.getAppSetting(LIVE_CUES_KEY));
    await repo.setAppSetting(LIVE_CUES_KEY, JSON.stringify(withSound(stored, kind, version)));
    revalidatePath("/admin/scout/pulsantiera");
    return { ok: true, message: `Suono caricato per «${CUE_META[kind].button}».` };
  } catch (error) {
    console.error("[uploadCueSoundAction]", error);
    return { ok: false, error: "Non è stato possibile caricare il suono. Riprova." };
  }
}

/** Toglie il suono caricato: il Monster block torna al suo grido, gli altri tasti tornano senza suono. */
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
    const back = defaultSoundUrl(kind) ? "torna al suono originale" : "torna senza suono, solo animazione";
    return { ok: true, message: `«${CUE_META[kind].button}» ${back}.` };
  } catch (error) {
    console.error("[removeCueSoundAction]", error);
    return { ok: false, error: "Non è stato possibile togliere il suono. Riprova." };
  }
}

/**
 * Non fa niente: il tablet la chiama ogni pochi minuti mentre la pulsantiera è aperta, così il server di Vercel resta «sveglio»
 * e il primo tocco non aspetta l'avvio da freddo (anche un paio di secondi). Nessun dato, nessuna lettura.
 */
export async function keepWarmAction(): Promise<number> {
  return Date.now();
}
