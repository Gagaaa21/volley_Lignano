import { getRepo } from "@/lib/db";
import { toPublicLiveScore } from "@/lib/liveScore";
import { liveScoreStateSchema } from "@/lib/liveScoreSchema";
import { isScoutTableMissing } from "@/lib/scout/missing";
import { latestPublicLive, toPublicScoutScore } from "@/lib/scout/publicScore";
import { readPublicScoutSnapshot } from "@/lib/scout/publicSnapshot";
import type { PublicLiveScore } from "@/lib/types";

/**
 * Punteggio live pubblico, senza accesso: `{ live: null }` finché un admin non
 * lo attiva, dal Live score (solo in Partita, a partita iniziata) oppure dallo
 * Scout («Punteggio live» acceso, dal primo punto segnato). Espone solo squadre,
 * punteggio, set e chi serve — mai nomi, numeri di maglia o formazioni (vedi
 * toPublicLiveScore e toPublicScoutScore). Se sono accesi entrambi vale quello
 * aggiornato per ultimo.
 *
 * Il punteggio dello Scout si legge dalla copia compatta che lo Scout aggiorna a
 * ogni salvataggio (publicSnapshot.ts): poche centinaia di byte, invece
 * dell'intero scout. Solo se la copia non c'è si ripiega sulla lettura completa.
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
  let fromLiveScore: PublicLiveScore | null = null;
  let fromScout: PublicLiveScore | null = null;
  try {
    const repo = await getRepo();
    // Le due fonti sono indipendenti: se una non risponde, l'altra funziona lo stesso.
    const [snapshot, compact] = await Promise.all([
      repo.getLiveScoreSnapshot().catch((error: unknown) => {
        console.error("[livescore] diretta pubblica non disponibile:", error);
        return null;
      }),
      // undefined = la copia non c'è o non si legge: si ripiega sulla lettura completa qui sotto.
      readPublicScoutSnapshot(repo).catch((error: unknown) => {
        console.error("[scout] copia compatta del punteggio live non leggibile:", error);
        return undefined;
      }),
    ]);
    const parsed = snapshot ? liveScoreStateSchema.safeParse(snapshot.state) : null;
    if (snapshot && parsed?.success) fromLiveScore = toPublicLiveScore(parsed.data, snapshot.updatedAt);
    if (compact !== undefined) {
      fromScout = compact;
    } else {
      const scouted = await repo.getPublicLiveScout().catch((error: unknown) => {
        // La tabella dello scout si crea a mano su Supabase: finché manca, niente da segnalare.
        if (!isScoutTableMissing(error)) console.error("[scout] punteggio live pubblico non disponibile:", error);
        return null;
      });
      if (scouted) fromScout = toPublicScoutScore(scouted.scout, scouted.match);
    }
  } catch (error) {
    console.error("[livescore] diretta pubblica non disponibile:", error);
  }
  return Response.json(
    { live: latestPublicLive(fromLiveScore, fromScout) },
    {
      headers: {
        "Cache-Control": "no-store",
        "Vercel-CDN-Cache-Control": "max-age=3, stale-while-revalidate=5",
      },
    },
  );
}
