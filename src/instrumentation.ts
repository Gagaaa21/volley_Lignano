/**
 * Ora italiana per tutto il server. Date e ore del sito (allenamenti,
 * partite, presenze) sono sempre «ora di Lignano», scritte senza fuso
 * ("2026-10-18T18:00"); il server di Vercel però gira in UTC, quindi «oggi»
 * cambiava solo alle 2 di notte e un orario come le 18:00 veniva letto come
 * le 20:00 italiane (i pronostici restavano aperti a partita iniziata).
 * Impostato qui, all'avvio, vale per ogni pagina, azione e calcolo di date.
 */
export function register() {
  process.env.TZ = "Europe/Rome";
}
