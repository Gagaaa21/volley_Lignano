import { getRepo } from "@/lib/db";
import { cueSoundKey, isCueKind, parseSound } from "@/lib/diretta/cues";

type RouteContext = { params: Promise<{ kind: string }> };

/**
 * Il suono caricato dallo staff per un tasto della pulsantiera (vedi src/lib/diretta/cues.ts), per la grafica della diretta.
 * Senza accesso (la grafica in Streamlabs / OBS non ha una sessione), ma è solo un suono di pochi secondi. L'indirizzo porta la versione
 * (`?v=` l'istante del caricamento), quindi la risposta non cambia mai: la rete di Vercel e il browser la tengono un anno, e il
 * database la legge una volta sola per ogni suono nuovo. Legge sempre l'archivio vero.
 */
export async function GET(request: Request, { params }: RouteContext) {
  const { kind } = await params;
  const asked = Number(new URL(request.url).searchParams.get("v"));
  if (!isCueKind(kind)) return new Response("Not found", { status: 404 });
  let sound = null;
  try {
    sound = parseSound(await (await getRepo()).getAppSetting(cueSoundKey(kind)));
  } catch (error) {
    console.error("[diretta] suono non disponibile:", error);
    return new Response("Unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  // Un file salvato con la sua versione si serve solo a quell'indirizzo: la risposta si tiene un anno, e con un'altra versione
  // (un file cambiato nel frattempo) la rete terrebbe il suono sbagliato sotto l'indirizzo vecchio.
  if (!sound || (sound.version !== undefined && sound.version !== asked)) {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const bytes = Buffer.from(sound.data, "base64");
  return new Response(bytes, {
    headers: {
      "Content-Type": sound.type,
      // Sempre e solo come audio: il tipo lo decide il sito (un elenco fisso), il browser non deve indovinarlo.
      "X-Content-Type-Options": "nosniff",
      "Content-Length": String(bytes.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "Vercel-CDN-Cache-Control": "max-age=31536000",
    },
  });
}
