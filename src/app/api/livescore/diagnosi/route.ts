import { getRepo, isDemoMode } from "@/lib/db";
import { deriveScout } from "@/lib/scout/derive";
import { toPublicScoutScore } from "@/lib/scout/publicScore";
import { PUBLIC_LIVE_SCOUT_KEY, readPublicScoutSnapshot } from "@/lib/scout/publicSnapshot";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * TEMPORANEO: dice dove si ferma il punteggio live dello Scout prima di arrivare al sito pubblico (copia compatta,
 * lettura completa, ultimi scout salvati). Solo stati, conteggi ed eventuali messaggi d'errore: nessun nome, nessun
 * contenuto dello scout. Va tolto appena trovata la causa.
 */
const short = (error: unknown) => String(error instanceof Error ? error.message : error).slice(0, 160);
const secondsAgo = (iso: string) => Math.round((Date.now() - Date.parse(iso)) / 1000);

export async function GET() {
  const out: Record<string, unknown> = { adesso: new Date().toISOString(), demo: isDemoMode() };
  const repo = await getRepo();

  // 1) La copia compatta.
  try {
    const raw = await repo.getAppSetting(PUBLIC_LIVE_SCOUT_KEY);
    let stato = "assente";
    let partita: string | undefined;
    let secondiFa: number | undefined;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { matchId?: string; live?: { updatedAt?: string } | null };
        partita = parsed.matchId;
        if (!parsed.live) {
          stato = "vuota";
        } else {
          secondiFa = parsed.live.updatedAt ? secondsAgo(parsed.live.updatedAt) : undefined;
          stato = (await readPublicScoutSnapshot(repo)) ? "viva" : "scaduta o non valida";
        }
      } catch {
        stato = "illeggibile";
      }
    }
    out.copia = { stato, partita, secondiFa, byte: raw?.length ?? 0 };
  } catch (error) {
    out.copia = { stato: "errore", errore: short(error) };
  }

  // 2) La lettura completa, come la fa l'endpoint pubblico quando la copia non c'è.
  try {
    const found = await repo.getPublicLiveScout();
    if (!found) {
      out.lettura = { trovata: false };
    } else {
      const lettura: Record<string, unknown> = {
        trovata: true,
        partita: found.scout.matchId,
        secondiFa: secondsAgo(found.scout.updatedAt),
        liveAcceso: found.scout.settings.publicLive,
        eventi: found.scout.events.length,
      };
      try {
        lettura.scambi = deriveScout(found.scout).rallies.length;
        lettura.punteggio = toPublicScoutScore(found.scout, found.match) ? "ok" : "null";
      } catch (error) {
        lettura.errore = short(error);
      }
      out.lettura = lettura;
    }
  } catch (error) {
    out.lettura = { errore: short(error) };
  }

  // 3) Gli ultimi scout salvati (solo impostazioni): il punteggio live arriva davvero al database?
  if (!isDemoMode()) {
    try {
      const { data, error } = await getSupabaseAdmin()
        .from("match_scouts")
        .select("match_id, version, updated_at, settings:data->settings")
        .order("updated_at", { ascending: false })
        .limit(3);
      if (error) throw new Error(error.message);
      out.ultimiScout = (data ?? []).map((row) => {
        const settings = (row.settings ?? {}) as { publicLive?: boolean; level?: string };
        return {
          partita: row.match_id as string,
          versione: row.version as number,
          secondiFa: secondsAgo(row.updated_at as string),
          liveAcceso: settings.publicLive ?? null,
          livello: settings.level ?? null,
        };
      });
    } catch (error) {
      out.ultimiScout = { errore: short(error) };
    }
  }

  return Response.json(out, { headers: { "Cache-Control": "no-store" } });
}
