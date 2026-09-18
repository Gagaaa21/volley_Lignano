import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function isSupabaseConfigured(): boolean {
  return Boolean(url && serviceRoleKey);
}

let cached: SupabaseClient | null = null;

/**
 * Server-only Supabase client using the service role key. Bypasses Row Level
 * Security, so it must never be imported from client components and the key
 * must never be exposed with a NEXT_PUBLIC_ prefix.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase non configurato: imposta SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  if (!cached) {
    cached = createClient(url!, serviceRoleKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
