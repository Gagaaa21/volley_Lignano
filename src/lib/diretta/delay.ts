import type { PublicLiveScore } from "@/lib/types";

/**
 * Il punteggio sulla pagina /diretta deve arrivare insieme al video, che YouTube mostra con 10–20 secondi di ritardo: le
 * letture si tengono in coda e si mostrano dopo il ritardo scelto. Funzioni pure: l'ora arriva da fuori.
 */
export interface Reading {
  /** Quando la pagina ha ricevuto la lettura (ms). */
  at: number;
  /** null = nessuna partita in diretta. */
  live: PublicLiveScore | null;
}

/** Le letture da mostrare adesso (le più vecchie per prime) e quelle che devono ancora aspettare. */
export function takeDue(queue: Reading[], now: number, delayMs: number): { due: Reading[]; rest: Reading[] } {
  const firstWaiting = queue.findIndex((reading) => reading.at + delayMs > now);
  return firstWaiting === -1 ? { due: queue, rest: [] } : { due: queue.slice(0, firstWaiting), rest: queue.slice(firstWaiting) };
}

/** Il ritardo in secondi da un valore qualunque (parametro dell'indirizzo, messaggio): 0–60, 0 se non è un numero. */
export function clampDelaySeconds(value: unknown): number {
  const seconds = typeof value === "number" ? value : Number(value);
  return Number.isFinite(seconds) ? Math.min(Math.max(Math.round(seconds), 0), 60) : 0;
}
