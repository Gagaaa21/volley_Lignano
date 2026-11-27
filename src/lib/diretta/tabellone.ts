import { TIMEOUT_MS } from "@/lib/timeoutClock";
import type { PublicLiveScore } from "@/lib/types";

/**
 * Il tabellone per la palestra (/tabellone/<chiave>): un tablet che fa da tabellone segnapunti, con il punteggio dello Scout. Non
 * è sul sito pubblico: si apre solo con il link con la chiave (vedi src/lib/scout/boardLink.ts), senza accesso, e funziona anche
 * con la diretta spenta (vedi src/lib/scout/boardSnapshot.ts).
 * Solo squadre, punti, set e time-out: mai una giocatrice. Qui solo i conti, senza React, così si provano da soli.
 */

/** Dove sta il tabellone: fuori dall'area riservata, per non avere sopra menu e guida del sito. */
export const BOARD_PATH = "/tabellone";

/** Ogni quanto rilegge il punteggio: ogni secondo mentre si gioca (è un dispositivo solo, come la grafica di Streamlabs). */
export const BOARD_LIVE_POLL_MS = 1_000;
/** Scout preparato ma ancora nessun punto: il primo punto compare entro 3 secondi. */
export const BOARD_PREGAME_POLL_MS = 3_000;
/** Nessuna partita in diretta, o partita finita: basta ogni 10 secondi (il piano gratuito conta ogni lettura). */
export const BOARD_IDLE_POLL_MS = 10_000;
/** Con lo schermo spento o la pagina in secondo piano non serve correre. */
export const BOARD_HIDDEN_POLL_MS = 15_000;
/** Dopo un errore di rete si riprova presto. */
export const BOARD_RETRY_MS = 2_000;
/** Oltre questo tempo senza una lettura riuscita il tabellone lo dice (il punteggio può essere vecchio). */
export const BOARD_STALE_MS = 8_000;
/** Finito il conto del time-out, il riquadro resta ancora un po' (a zero) e poi si chiude da solo. */
export const BOARD_TIMEOUT_LINGER_MS = 5_000;
/**
 * Gli orologi del dispositivo dello Scout e del tablet del tabellone possono differire un poco. Se l'ora del time-out risulta nel
 * futuro di più di così, l'orologio dello Scout è avanti: il conto parte da quando il tabellone lo vede.
 */
export const BOARD_CLOCK_SLACK_MS = 5_000;

export function boardPollDelay(live: PublicLiveScore | null, hidden: boolean): number {
  if (hidden) return BOARD_HIDDEN_POLL_MS;
  if (!live || live.finished) return BOARD_IDLE_POLL_MS;
  return live.notStarted ? BOARD_PREGAME_POLL_MS : BOARD_LIVE_POLL_MS;
}

export type BoardSide = "home" | "away";

/** Un time-out in corso, visto dal tabellone: quale (l'id dello Scout), chi l'ha chiesto e quando finisce il conto dei 30 secondi. */
export interface BoardTimeout {
  id: string;
  side: BoardSide;
  endsAt: number;
}

/**
 * Il time-out da mostrare dopo una lettura. Lo Scout dice se c'è un time-out in corso (chiesto e senza punti dopo) e quando l'ha
 * segnato (`timeoutRun`, vedi boardSnapshot.ts): il conto dei 30 secondi parte da lì, quindi è giusto anche se il tabellone si
 * apre a time-out cominciato, se il primo punto e il time-out arrivano insieme, o se la rete torna dopo un buco. Lo stesso
 * time-out (stesso id) tiene il conto che ha. Sparisce quando riprende il gioco o il time-out viene tolto nello Scout (la lettura
 * non lo porta più); finito il conto, chi lo mostra lo toglie dopo BOARD_TIMEOUT_LINGER_MS. Uno vecchio (finito da un pezzo, per
 * esempio a set fermo) non si mostra.
 */
export function nextBoardTimeout(next: PublicLiveScore | null, current: BoardTimeout | null, now: number): BoardTimeout | null {
  const run = next && !next.finished ? next.timeoutRun : undefined;
  if (!run) return null;
  if (current?.id === run.id) return current;
  // L'orologio dello Scout avanti di troppo: si conta da adesso. Altrimenti dall'ora del tocco (un time-out vecchio è già finito).
  const endsAt = run.at - now > BOARD_CLOCK_SLACK_MS ? now + TIMEOUT_MS : run.at + TIMEOUT_MS;
  return { id: run.id, side: run.side, endsAt };
}

/** Il time-out da far vedere adesso (null se non c'è, o se il conto è finito da più di BOARD_TIMEOUT_LINGER_MS). */
export function visibleBoardTimeout(timeout: BoardTimeout | null, now: number): BoardTimeout | null {
  return timeout && now < timeout.endsAt + BOARD_TIMEOUT_LINGER_MS ? timeout : null;
}

/** I secondi che restano del time-out, da 30 a 0. */
export function boardTimeoutSeconds(timeout: BoardTimeout, now: number): number {
  return Math.min(TIMEOUT_MS / 1000, Math.max(0, Math.ceil((timeout.endsAt - now) / 1000)));
}

/** Il titolo sopra il punteggio: il set in corso («2° set», «Tie-break»), «Si comincia» prima del primo punto o «Finale». */
export function boardSetLabel(live: PublicLiveScore): string {
  if (live.finished) return "Finale";
  if (live.notStarted) return "Si comincia";
  if (live.setRules?.deciding) return "Tie-break";
  return `${live.sets.length + 1}° set`;
}
