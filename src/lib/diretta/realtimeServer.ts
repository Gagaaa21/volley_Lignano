import "server-only";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { CUE_CHANNEL, CUE_EVENT, SUPABASE_PUBLISHABLE_KEY, type RealtimeConfig } from "./realtime";

/** Quanto si aspetta il campanello prima di rinunciare: la scritta è già salvata, la grafica la trova comunque leggendo. */
const RING_TIMEOUT_MS = 1_500;

/**
 * Il canale in tempo reale per la grafica (vedi realtime.ts), solo quando il sito usa Supabase: in prova e con l'archivio in
 * memoria non c'è niente da ascoltare, e la grafica legge come prima.
 */
export function realtimeConfig(): RealtimeConfig | null {
  const url = process.env.SUPABASE_URL;
  if (!url || !isSupabaseConfigured()) return null;
  return { url, key: SUPABASE_PUBLISHABLE_KEY };
}

/**
 * Suona il campanello della pulsantiera (Supabase Realtime, broadcast via REST con la chiave del server): la grafica rilegge
 * subito la scritta. Dentro solo l'id della scritta, nessun dato. Non fallisce mai: se il canale non risponde la grafica la
 * vede alla lettura successiva.
 */
export async function ringCue(id: string): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RING_TIMEOUT_MS);
  try {
    const res = await fetch(`${url.replace(/\/+$/, "")}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ topic: CUE_CHANNEL, event: CUE_EVENT, payload: { id } }] }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) console.error("[pulsantiera] campanello non suonato:", res.status, await res.text().catch(() => ""));
  } catch (error) {
    console.error("[pulsantiera] campanello non suonato:", error);
  } finally {
    clearTimeout(timer);
  }
}
