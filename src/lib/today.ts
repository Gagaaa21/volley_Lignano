import { format } from "date-fns";

/** Data di oggi, "YYYY-MM-DD", nell'ora locale: quella italiana sul server
 * (vedi src/instrumentation.ts), quella del telefono o del computer nel
 * browser. Mai toISOString(): è sempre UTC, e tra mezzanotte e le 2 di notte
 * italiane darebbe ancora il giorno prima. */
export function todayIso(now: Date = new Date()): string {
  return format(now, "yyyy-MM-dd");
}

/** Data e ora di adesso, "YYYY-MM-DDTHH:mm", scritte come quelle delle partite (ora locale, senza fuso): si confrontano come testo. */
export function nowLocalIso(now: Date = new Date()): string {
  return format(now, "yyyy-MM-dd'T'HH:mm");
}
