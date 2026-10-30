import { manualLogoFor } from "@/components/calendar/manualTeamLogos";
import { getRepo } from "@/lib/db";
import { opponentLogoFor } from "@/lib/federation/teamLogos";
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
 * Con `?prima=1` (la grafica della diretta video, vedi /diretta/grafica) risponde
 * anche la partita dello Scout con il live acceso ma ancora senza punti, a 0–0
 * (`notStarted`): così la barra compare appena si accende il live. Senza il
 * parametro, come per il banner del sito, quella partita non c'è: il riquadro
 * compare dal primo punto.
 *
 * Alle partite U14/U15 si aggiunge il logo dell'avversaria (`away.logo`, un
 * indirizzo del nostro sito) quando il suo nome combacia con una squadra della
 * classifica del girone (vedi src/lib/federation/teamLogos.ts).
 *
 * Il punteggio dello Scout si legge dalla copia compatta che lo Scout aggiorna a
 * ogni salvataggio (publicSnapshot.ts): poche centinaia di byte, invece
 * dell'intero scout. Se la copia non c'è, o non dice «in diretta», si ripiega
 * sulla lettura completa: così una copia mancata non nasconde mai una partita viva.
 *
 * Il sito la rilegge ogni pochi secondi da ogni telefono aperto sulla home:
 * la rete di Vercel (CDN) tiene la risposta 3 secondi, così il database riceve
 * al più una lettura ogni qualche secondo, qualunque sia il numero di
 * spettatori. Il browser invece non la conserva mai (`no-store`): con una
 * copia locale «da riconvalidare in sottofondo» mostrerebbe il punteggio con
 * un giro di ritardo. Legge sempre l'archivio vero, mai quello della modalità
 * prova.
 *
 * Con `?regia=1` (la grafica dentro Streamlabs / OBS: un solo computer, che
 * rilegge ogni secondo) la risposta non passa dalla copia della CDN: con quella
 * il punto entrava nel video fino a 8 secondi dopo il tocco nello Scout, ora
 * circa uno. Una lettura al secondo da un computer solo il database non la sente.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const withNotStarted = params.get("prima") === "1";
  const direct = params.get("regia") === "1";
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
    if (compact) {
      fromScout = compact;
    } else {
      // Nessuna copia viva (non c'è, dice «niente» o non si legge): si legge lo scout come si faceva prima della copia. Con
      // nessuna partita in diretta non c'è nessuna riga da scaricare, quindi non costa niente.
      const scouted = await repo.getPublicLiveScout().catch((error: unknown) => {
        // La tabella dello scout si crea a mano su Supabase: finché manca, niente da segnalare.
        if (!isScoutTableMissing(error)) console.error("[scout] punteggio live pubblico non disponibile:", error);
        return null;
      });
      if (scouted) {
        try {
          fromScout = toPublicScoutScore(scouted.scout, scouted.match);
        } catch (error) {
          console.error("[scout] punteggio live pubblico non calcolabile:", error);
        }
      }
    }
  } catch (error) {
    console.error("[livescore] diretta pubblica non disponibile:", error);
  }
  let live = latestPublicLive(fromLiveScore, fromScout);
  if (live?.notStarted && !withNotStarted) live = null;
  // Il logo dell'avversaria dalla classifica del girone (le classifiche si tengono in memoria qualche minuto: di norma non
  // costa letture). Mai nella copia compatta di Supabase, e un logo che non si trova non rompe mai il punteggio.
  if (live && live.team === "u14u15") {
    try {
      const logo = await opponentLogoFor(await getRepo(), live.category, live.away.name, { manualLogo: (team) => manualLogoFor(team)?.src ?? null });
      if (logo) live = { ...live, away: { ...live.away, logo } };
    } catch (error) {
      console.error("[livescore] logo dell'avversaria non disponibile:", error);
    }
  }
  return Response.json(
    { live },
    { headers: direct ? { "Cache-Control": "no-store" } : { "Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "max-age=3, stale-while-revalidate=5" } },
  );
}
