/**
 * Lo scout vive in una tabella a parte (`match_scouts`, vedi supabase/schema.sql)
 * da creare su Supabase una volta sola. Il sito si aggiorna da solo a ogni
 * pubblicazione, la tabella no: nel frattempo, invece di una pagina d'errore
 * generica, si spiega cosa manca. Riconosce l'errore «tabella inesistente» di
 * Postgres e di Supabase (PostgREST).
 */
export function isScoutTableMissing(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return /match_scouts/i.test(message) && /(does not exist|could not find the table|schema cache|42P01|PGRST205)/i.test(message);
}
