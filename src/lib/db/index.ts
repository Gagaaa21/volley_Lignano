import "server-only";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import type { Repo } from "@/lib/db/repo";

export function isDemoMode(): boolean {
  return !isSupabaseConfigured();
}

let cached: Repo | null = null;

export async function getRepo(): Promise<Repo> {
  if (!cached) {
    cached = isSupabaseConfigured()
      ? (await import("@/lib/db/supabase")).supabaseRepo
      : (await import("@/lib/db/memory")).memoryRepo;
  }
  return cached;
}

export type { Repo, MatchFilter, NewStaffInput } from "@/lib/db/repo";
