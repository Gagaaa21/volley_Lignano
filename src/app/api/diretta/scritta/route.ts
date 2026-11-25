import { getRepo } from "@/lib/db";
import { LIVE_CUES_KEY, publicCueFrom, publicCueSounds } from "@/lib/diretta/cues";

// La scritta appena mandata, subito: mai una copia della rete o del browser.
export const dynamic = "force-dynamic";

/**
 * Solo la scritta della pulsantiera (vedi src/lib/diretta/cues.ts), per la grafica di Streamlabs / OBS quando suona il
 * campanello in tempo reale (vedi src/lib/diretta/realtime.ts): una lettura sola di app_settings, molto più leggera del
 * punteggio. Senza accesso, come il punteggio pubblico: solo il tipo di scritta, la sua età e la versione del suono, mai una
 * giocatrice. Legge sempre l'archivio vero.
 */
export async function GET() {
  let raw: string | null = null;
  try {
    raw = await (await getRepo()).getAppSetting(LIVE_CUES_KEY);
  } catch (error) {
    console.error("[pulsantiera] scritta non leggibile:", error);
    return Response.json({ cue: null, cueSounds: {} }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return Response.json({ cue: publicCueFrom(raw, Date.now()), cueSounds: publicCueSounds(raw) }, { headers: { "Cache-Control": "no-store" } });
}
