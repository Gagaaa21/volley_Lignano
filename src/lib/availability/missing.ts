/**
 * I link dei genitori e le non disponibilità vivono in due tabelle a parte (`athlete_family_links` e `match_unavailability`,
 * vedi supabase/schema.sql) da creare su Supabase una volta sola. Il sito si aggiorna da solo a ogni pubblicazione, le tabelle
 * no: nel frattempo, invece di una pagina d'errore generica, si spiega cosa manca. Riconosce l'errore «tabella inesistente» di
 * Postgres e di Supabase (PostgREST).
 */
export function isAvailabilityTableMissing(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return (
    /(athlete_family_links|match_unavailability)/i.test(message) &&
    /(does not exist|could not find the table|schema cache|42P01|PGRST205)/i.test(message)
  );
}
