import "server-only";
import { revalidateTag } from "next/cache";
import { after } from "next/server";
import { getRepo, isDemoMode } from "@/lib/db";
import { AUTO_REFRESH_MIN_INTERVAL_MS, refreshFederation } from "@/lib/federation/refresh";
import { PUBLIC_CALENDAR_TAG } from "@/lib/publicCalendarData";

/** Ogni istanza del server controlla al massimo ogni 5 minuti se i dati sono
 * da rinfrescare: così una pagina molto visitata non fa una lettura del
 * database per ogni visita. */
const LOCAL_CHECK_INTERVAL_MS = 5 * 60 * 1000;
let lastLocalCheck = 0;

/**
 * Da chiamare dalle pagine che mostrano dati della federazione. A risposta
 * già inviata (dopo `after`) rilegge i gironi, ma solo se l'ultimo tentativo
 * ha più di 30 minuti: chi apre la pagina non aspetta mai il portale, e i
 * dati restano aggiornati anche senza un cron frequente (sul piano gratuito
 * di Vercel i cron sono al massimo giornalieri).
 *
 * Non fa nulla in modalità demo: lì i dati si aggiornano a mano dal pulsante
 * «Aggiorna ora», così sviluppo e test non toccano mai il portale vero.
 */
export function scheduleFederationRefresh(): void {
  if (isDemoMode()) return;
  if (Date.now() - lastLocalCheck < LOCAL_CHECK_INTERVAL_MS) return;
  lastLocalCheck = Date.now();

  after(async () => {
    try {
      const outcomes = await refreshFederation(await getRepo(), { minIntervalMs: AUTO_REFRESH_MIN_INTERVAL_MS });
      if (outcomes.some((outcome) => outcome.status === "updated")) {
        revalidateTag(PUBLIC_CALENDAR_TAG, "max");
      }
    } catch (error) {
      // Mai un errore qui deve toccare chi sta guardando la pagina.
      console.error("[federation] aggiornamento in secondo piano non riuscito:", error);
    }
  });
}
