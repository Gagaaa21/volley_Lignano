import "server-only";
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
export async function getActiveRepo(): Promise<Repo> {
  const [session, real] = await Promise.all([getSession(), getRepo()]);
  if (session?.role === "dev" && session.testMode) {
    const { getTestRepo } = await import("@/lib/db/testMode");
    return getTestRepo(real);
  }
  return real;
}

export type { Repo, MatchFilter, NewStaffInput } from "@/lib/db/repo";
