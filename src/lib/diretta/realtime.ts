/**
 * Il «campanello» della pulsantiera della diretta: appena lo staff tocca un tasto, il server suona su un canale in tempo reale di
 * Supabase (Realtime, broadcast) e la grafica di Streamlabs / OBS, che lo ascolta, rilegge subito la scritta dal sito
 * (/api/diretta/scritta): in onda in meno di un secondo, invece di aspettare la lettura successiva (che senza una partita in
 * diretta arriva ogni 15 secondi, e una scritta più vecchia di 15 secondi non parte più).
 *
 * Il messaggio è solo un campanello: la grafica non si fida di quello che c'è dentro e va a leggere la scritta vera, che può
 * scrivere solo lo staff con l'accesso (sendCueAction). Il canale è pubblico (chi ha la chiave pubblica può suonarlo), quindi
 * chi lo suonasse per scherzo farebbe solo rileggere la grafica, al più qualche volta al secondo (RING_MIN_GAP_MS), senza
 * far partire niente.
 *
 * La chiave è quella «publishable» del progetto Supabase: è fatta per stare nel browser e da sola non dà accesso a nessun dato
 * (tutte le tabelle hanno RLS e nessun permesso per il ruolo anon, il bucket dei certificati è privato: verificato prima di
 * usarla). Il canale lo ascolta solo la grafica dentro Streamlabs / OBS (un computer), mai chi guarda da /diretta.
 */

export const CUE_CHANNEL = "pulsantiera";
export const CUE_EVENT = "scritta";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_IC7i_tHs9xJDuk3cqdW3kA_jWbZXsIv";

/** Due campanelli più vicini di così fanno una lettura sola. */
export const RING_MIN_GAP_MS = 400;

/** Dove collegarsi: l'indirizzo del progetto Supabase (dal server) e la chiave pubblica. null = niente canale (prove, memoria). */
export interface RealtimeConfig {
  url: string;
  key: string;
}

/** L'indirizzo del canale in tempo reale a partire da quello del progetto (https://… -> wss://…/realtime/v1). */
export function realtimeSocketUrl(projectUrl: string): string {
  return `${projectUrl.replace(/^http/, "ws").replace(/\/+$/, "")}/realtime/v1`;
}
