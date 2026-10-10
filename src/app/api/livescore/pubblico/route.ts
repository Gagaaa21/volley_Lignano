import { getRepo } from "@/lib/db";
import { toPublicLiveScore } from "@/lib/liveScore";
import { liveScoreStateSchema } from "@/lib/liveScoreSchema";
import type { PublicLiveScore } from "@/lib/types";

/**
 * Diretta pubblica del tabellone live, senza accesso: `{ live: null }` finché
 * un admin non la attiva da Live score (solo in Partita, a partita iniziata).
 * Espone solo squadre, punteggio, set e chi serve — mai nomi, numeri di maglia
 * o formazioni (vedi toPublicLiveScore).
 *
 * Il sito la rilegge ogni pochi secondi da ogni telefono aperto sulla home:
 * la rete di Vercel (CDN) tiene la risposta 3 secondi, così il database riceve
 * al più una lettura ogni qualche secondo, qualunque sia il numero di
 * spettatori. Il browser invece non la conserva mai (`no-store`): con una
 * copia locale «da riconvalidare in sottofondo» mostrerebbe il punteggio con
 * un giro di ritardo. Legge sempre l'archivio vero, mai quello della modalità
 * prova.
 */
export async function GET() {
  let live: PublicLiveScore | null = null;
  try {
    const repo = await getRepo();
    const snapshot = await repo.getLiveScoreSnapshot();
    const parsed = snapshot ? liveScoreStateSchema.safeParse(snapshot.state) : null;
    if (snapshot && parsed?.success) live = toPublicLiveScore(parsed.data, snapshot.updatedAt);
  } catch (error) {
    console.error("[livescore] diretta pubblica non disponibile:", error);
  }
  return Response.json(
    { live },
    {
      headers: {
        "Cache-Control": "no-store",
        "Vercel-CDN-Cache-Control": "max-age=3, stale-while-revalidate=5",
      },
    },
  );
}
