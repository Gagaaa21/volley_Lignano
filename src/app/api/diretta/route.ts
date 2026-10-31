import { getRepo } from "@/lib/db";
import { DEFAULT_DELAY_SECONDS, LIVE_STREAM_KEY, parseStreamSettings } from "@/lib/diretta/streams";

/**
 * Le camere della diretta video, per la pagina /diretta dei genitori: senza accesso, solo nome e identificativo YouTube di
 * ogni camera, il ritardo del punteggio e se la grafica è già dentro il video (mai altro). `cameras: []` quando lo staff non ha incollato nessun link o i link sono
 * più vecchi di 12 ore. La rete di Vercel tiene la risposta 10 secondi: la pagina la rilegge ogni minuto da ogni telefono,
 * il database ne vede al più una ogni poco, qualunque sia il numero di spettatori. Legge sempre l'archivio vero.
 */
export async function GET() {
  let settings = null;
  try {
    settings = parseStreamSettings(await (await getRepo()).getAppSetting(LIVE_STREAM_KEY));
  } catch (error) {
    console.error("[diretta] impostazioni non disponibili:", error);
  }
  return Response.json(
    {
      cameras: settings?.cameras ?? [],
      delaySeconds: settings?.delaySeconds ?? DEFAULT_DELAY_SECONDS,
      graphicInVideo: settings?.graphicInVideo === true,
    },
    { headers: { "Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "max-age=10, stale-while-revalidate=20" } },
  );
}
