import "server-only";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import type { Repo } from "@/lib/db/repo";

export function isDemoMode(): boolean {
  return !isSupabaseConfigured();
}

let cached: Repo | null = null;

/** Sempre il repo reale (Supabase o demo in-memory). Usato dalla home
 * pubblica: non deve mai dipendere dalla sessione di chi visita. */
export async function getRepo(): Promise<Repo> {
  if (!cached) {
    cached = isSupabaseConfigured()
      ? (await import("@/lib/db/supabase")).supabaseRepo
      : (await import("@/lib/db/memory")).memoryRepo;
  }
  return cached;
}

/**
 * Come getRepo(), ma per le pagine e le azioni dell'area riservata: se il
 * developer ha attivato la modalità prova, instrada allenamenti, partite,
 * formazioni, schede, presenze e atlete verso l'archivio temporaneo separato
 * invece che sul database reale. Staff e iscrizioni push restano comunque
 * reali. Non va mai usata dalla home pubblica.
 */
/**
 * Avvolto in React cache() perché in modalità prova ogni chiamata rilegge
 * l'intero archivio sandbox da Supabase (necessario per restare corretti tra
 * istanze serverless diverse, vedi src/lib/db/testMode.ts) — senza questa
 * memoizzazione, una pagina o un'azione che chiama getActiveRepo() più volte
 * nella stessa richiesta ripeterebbe quel fetch inutilmente, appesantendo
 * (o facendo percepire come "bloccata") la modalità prova.
 */
export const getActiveRepo = cache(async (): Promise<Repo> => {
  const [session, real] = await Promise.all([getSession(), getRepo()]);
  if (session?.role === "dev" && session.testMode) {
    const { getTestRepo } = await import("@/lib/db/testMode");
    return await getTestRepo(real);
  }
  return real;
});

export type { Repo, MatchFilter, NewStaffInput } from "@/lib/db/repo";
