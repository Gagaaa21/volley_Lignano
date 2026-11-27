/**
 * Il costo di calcolo delle password (bcrypt) e un hash «finto» con lo stesso costo. All'accesso, se il nome utente non esiste, si
 * confronta comunque la password con questo hash: così la risposta arriva nello stesso tempo di quella per un account vero, e chi
 * prova non può capire dai tempi (un rifiuto subito, o dopo un po') quali nomi utente esistono. L'hash è di una password
 * qualunque, mai usata da nessuno: non apre niente. Valori puri, provati in unit/password-cost.spec.ts.
 */

/** Costo di tutti gli hash del sito: se si cambia, cambia anche per l'hash finto qui sotto (la prova lo controlla). */
export const BCRYPT_COST = 10;

export const UNKNOWN_ACCOUNT_HASH = "$2b$10$qEw7VEsb6MtFTcPEY/30re/Y1WXVdqlbH7L/IxaDcJwhBcMOzEwIS";
