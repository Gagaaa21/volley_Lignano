/**
 * Le trasferte vivono in due tabelle a parte (`match_trips` e `athlete_contacts`, vedi supabase/schema.sql) da creare su
 * Supabase una volta sola. Il sito si aggiorna da solo a ogni pubblicazione, le tabelle no: nel frattempo, invece di una
 * pagina d'errore generica, si spiega cosa manca. Riconosce l'errore «tabella inesistente» di Postgres e di Supabase (PostgREST).
 */
export function isTripTableMissing(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return /(match_trips|athlete_contacts)/i.test(message) && /(does not exist|could not find the table|schema cache|42P01|PGRST205)/i.test(message);
}
