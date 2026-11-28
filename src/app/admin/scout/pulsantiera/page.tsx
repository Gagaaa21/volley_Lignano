import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/auth/guard";
import { getRepo } from "@/lib/db";
import { isSilenceOn, LIVE_CUES_KEY, LIVE_SILENCE_KEY, parseCues, parseSilence } from "@/lib/diretta/cues";
import { Pulsantiera } from "./Pulsantiera";

export const metadata: Metadata = {
  title: "Pulsantiera della diretta",
};

/** Il minuto di silenzio acceso adesso, se c'è: la pulsantiera lo mostra già acceso (pagina ricaricata, un altro tablet). */
function currentSilence(raw: string | null): { id: string; at: number; text: string | null } | null {
  const stored = parseSilence(raw);
  return isSilenceOn(stored, Date.now()) ? { id: stored.id, at: stored.at, text: stored.text } : null;
}

/**
 * La pulsantiera della diretta: su un tablet in palestra, come uno Stream Deck. Un tocco e nella grafica di Streamlabs / OBS
 * parte una scritta («MONSTER BLOCK», «ACE»…; il Monster block anche con il suo grido); in più il minuto di silenzio. Riservata
 * a chi ha il permesso «Scout».
 */
export default async function PulsantieraPage() {
  const session = await requireStaffPage("scout");
  let sounds: Record<string, number> = {};
  let silence: { id: string; at: number; text: string | null } | null = null;
  try {
    const settings = await (await getRepo()).getAppSettings([LIVE_CUES_KEY, LIVE_SILENCE_KEY]);
    sounds = parseCues(settings[LIVE_CUES_KEY] ?? null).sounds;
    silence = currentSilence(settings[LIVE_SILENCE_KEY] ?? null);
  } catch (error) {
    console.error("[pulsantiera] stato non disponibile:", error);
  }
  return <Pulsantiera sounds={sounds} silence={silence} testMode={session.testMode === true} />;
}
