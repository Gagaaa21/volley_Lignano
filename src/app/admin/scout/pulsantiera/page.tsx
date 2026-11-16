import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/auth/guard";
import { getRepo } from "@/lib/db";
import { LIVE_CUES_KEY, parseCues } from "@/lib/diretta/cues";
import { Pulsantiera } from "./Pulsantiera";

export const metadata: Metadata = {
  title: "Pulsantiera della diretta",
};

/**
 * La pulsantiera della diretta: su un tablet in palestra, come uno Stream Deck. Un tocco e nella grafica di Streamlabs / OBS
 * parte una scritta animata («MONSTER BLOCK», «ACE»…; il Monster block anche con il suo grido). Riservata a chi ha il permesso «Scout».
 */
export default async function PulsantieraPage() {
  const session = await requireStaffPage("scout");
  let sounds: Record<string, number> = {};
  try {
    sounds = parseCues(await (await getRepo()).getAppSetting(LIVE_CUES_KEY)).sounds;
  } catch (error) {
    console.error("[pulsantiera] suoni non disponibili:", error);
  }
  return <Pulsantiera sounds={sounds} testMode={session.testMode === true} />;
}
