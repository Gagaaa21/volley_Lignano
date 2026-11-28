import { getRepo } from "@/lib/db";
import { LIVE_CUE_LAST_KEY, LIVE_CUES_KEY, LIVE_SILENCE_KEY, publicCueFrom, publicCueSounds, publicSilenceFrom } from "@/lib/diretta/cues";

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
  let rawLast: string | null = null;
  let rawSilence: string | null = null;
  try {
    // L'ultima scritta e i suoni stanno in due chiavi (vedi cues.ts): una query sola.
    const settings = await (await getRepo()).getAppSettings([LIVE_CUES_KEY, LIVE_CUE_LAST_KEY, LIVE_SILENCE_KEY]);
    raw = settings[LIVE_CUES_KEY] ?? null;
    rawLast = settings[LIVE_CUE_LAST_KEY] ?? null;
    rawSilence = settings[LIVE_SILENCE_KEY] ?? null;
  } catch (error) {
    console.error("[pulsantiera] scritta non leggibile:", error);
    return Response.json({ cue: null, cueSounds: {}, silence: null }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const now = Date.now();
  return Response.json(
    { cue: publicCueFrom(raw, now, rawLast), cueSounds: publicCueSounds(raw), silence: publicSilenceFrom(rawSilence, now) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
