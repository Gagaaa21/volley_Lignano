import type { PublicLiveScore } from "@/lib/types";

/**
 * Il punteggio sulla pagina /diretta deve arrivare insieme al video, che YouTube mostra con 10–20 secondi di ritardo: le
 * letture si tengono in coda e si mostrano dopo il ritardo scelto. Funzioni pure: l'ora arriva da fuori.
 *
 * Il ritardo si conta dall'istante del punto, non da quando la lettura arriva: ogni lettura porta l'ora in cui lo Scout l'ha
 * salvata (`updatedAt`, orologio del server), e la pagina la porta sul suo orologio con lo scarto più piccolo visto finora tra
 * arrivo e salvataggio. Così la copia della CDN, che può arrivare fino a qualche secondo dopo, non fa più ballare il
 * punteggio: ogni punto compare sempre lo stesso tempo dopo essere stato segnato, e un orologio del telefono avanti o
 * indietro non conta (lo scarto lo assorbe).
 */
export interface Reading {
  /** Quando la pagina ha ricevuto la lettura (ms, orologio di chi guarda). */
  at: number;
  /** Quando è stata salvata (ms, orologio del server); null se non si sa (nessuna partita, data illeggibile). */
  stamp: number | null;
  /** null = nessuna partita in diretta. */
  live: PublicLiveScore | null;
}

/** L'ora del salvataggio di una lettura (ms), o null. */
export function stampOf(live: PublicLiveScore | null): number | null {
  if (!live) return null;
  const ms = Date.parse(live.updatedAt);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Lo scarto tra l'orologio di chi guarda e quello del server, più il viaggio più breve: il più piccolo visto tra arrivo e
 * salvataggio. Una lettura vecchia (la prima, a partita già avviata) dà uno scarto grande, che la prima lettura fresca abbassa.
 */
export function nextOffset(offset: number | null, reading: Reading): number | null {
  if (reading.stamp === null) return offset;
  const gap = reading.at - reading.stamp;
  return offset === null ? gap : Math.min(offset, gap);
}

/** Da quando contare il ritardo di una lettura (orologio di chi guarda): l'istante del punto se si sa, se no l'arrivo. */
export function readingTime(reading: Reading, offset: number | null): number {
  return reading.stamp !== null && offset !== null ? reading.stamp + offset : reading.at;
}

/** Le letture da mostrare adesso (le più vecchie per prime) e quelle che devono ancora aspettare. */
export function takeDue(queue: Reading[], now: number, delayMs: number, offset: number | null = null): { due: Reading[]; rest: Reading[] } {
  const firstWaiting = queue.findIndex((reading) => readingTime(reading, offset) + delayMs > now);
  return firstWaiting === -1 ? { due: queue, rest: [] } : { due: queue.slice(0, firstWaiting), rest: queue.slice(firstWaiting) };
}

/** Il ritardo in secondi da un valore qualunque (parametro dell'indirizzo, messaggio): 0–60, 0 se non è un numero. */
export function clampDelaySeconds(value: unknown): number {
  const seconds = typeof value === "number" ? value : Number(value);
  return Number.isFinite(seconds) ? Math.min(Math.max(Math.round(seconds), 0), 60) : 0;
}
