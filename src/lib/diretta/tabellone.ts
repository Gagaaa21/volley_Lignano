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
 * Il conto del time-out parte solo se la lettura di prima è di poco fa: dopo un buco (rete persa, schermo spento) il time-out
 * può essere cominciato da un pezzo, e un conto da 30 sarebbe sbagliato. Con le letture ogni secondo, e un nuovo tentativo dopo 2
 * secondi se una va male, un buco più lungo di così vuol dire che qualcosa si è perso.
 */
export const BOARD_TIMEOUT_MAX_GAP_MS = 5_000;

export function boardPollDelay(live: PublicLiveScore | null, hidden: boolean): number {
  if (hidden) return BOARD_HIDDEN_POLL_MS;
  if (!live || live.finished) return BOARD_IDLE_POLL_MS;
  return live.notStarted ? BOARD_PREGAME_POLL_MS : BOARD_LIVE_POLL_MS;
}

export type BoardSide = "home" | "away";

/** Un time-out in corso, visto dal tabellone: chi l'ha chiesto, quando finisce il conto e a che punto della partita è partito. */
export interface BoardTimeout {
  side: BoardSide;
  endsAt: number;
  /** Set chiusi e punti del set quando è partito: se cambiano, il gioco è ripreso. */
  sets: number;
  points: number;
}

function inPlay(live: PublicLiveScore | null): live is PublicLiveScore {
  return Boolean(live && !live.finished && !live.notStarted);
}

/**
 * Il time-out da mostrare dopo una lettura. Lo Scout dice solo quanti time-out ha usato ogni squadra nel set: il conto (30
 * secondi) parte quando il tabellone vede il numero salire, cioè circa un secondo dopo il tocco nello Scout. Si chiude quando
 * riprende il gioco (cambia il punteggio o il set), quando il time-out viene tolto nello Scout, o poco dopo la fine del conto.
 * Alla prima lettura, o dopo un buco di più di BOARD_TIMEOUT_MAX_GAP_MS dalla lettura di prima (`previousAt`), un time-out già
 * segnato non fa partire niente: non si sa da quanto dura.
 */
export function nextBoardTimeout(
  previous: PublicLiveScore | null,
  next: PublicLiveScore | null,
  current: BoardTimeout | null,
  now: number,
  previousAt: number = now,
): BoardTimeout | null {
  if (!inPlay(next)) return null;
  const sets = next.sets.length;
  const points = next.home.score + next.away.score;
  if (inPlay(previous) && previous.sets.length === sets && now - previousAt <= BOARD_TIMEOUT_MAX_GAP_MS) {
    for (const side of ["home", "away"] as const) {
      if (next.timeouts[side] > previous.timeouts[side]) return { side, endsAt: now + TIMEOUT_MS, sets, points };
    }
  }
  if (!current) return null;
  const resumed = current.sets !== sets || current.points !== points;
  const removed = next.timeouts[current.side] === 0 || (inPlay(previous) && next.timeouts[current.side] < previous.timeouts[current.side]);
  if (resumed || removed || now >= current.endsAt + BOARD_TIMEOUT_LINGER_MS) return null;
  return current;
}

/** Il titolo sopra il punteggio: il set in corso («2° set», «Tie-break»), «Si comincia» prima del primo punto o «Finale». */
export function boardSetLabel(live: PublicLiveScore): string {
  if (live.finished) return "Finale";
  if (live.notStarted) return "Si comincia";
  if (live.setRules?.deciding) return "Tie-break";
  return `${live.sets.length + 1}° set`;
}
