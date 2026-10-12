/**
 * Le regole dei set e della partita, uguali per Live score e Scout (Regole di
 * Gioco FIVB/FIPAV, adattate alle formule delle gare giovanili regionali):
 * - un set si vince arrivando a 25 punti (15 il set decisivo) con almeno due
 *   punti di scarto: se si è sul 24-24 si va avanti finché uno non stacca di due;
 * - la partita è al meglio dei 5 set (3 vinti), dei 3 (2 vinti) oppure di 3 set
 *   da giocare tutti;
 * - ogni set comincia con la battuta alternata (chi ha battuto per primo nel
 *   set appena chiuso batte per secondo nel successivo); solo nel set decisivo
 *   si rifà il sorteggio;
 * - a ogni set le squadre cambiano campo; nel set decisivo si cambia anche
 *   quando una squadra arriva a 8 punti (senza toccare la rotazione);
 * - ogni squadra ha 2 time-out per set, di 30 secondi, e fino a 8 sostituzioni
 *   per set (regole della stagione 2026/2027, vedi più sotto).
 */

export type MatchFormat = "bo5" | "bo3" | "fixed3";

export const MATCH_FORMAT_LABELS: Record<MatchFormat, string> = {
  bo5: "Al meglio dei 5 set",
  bo3: "Al meglio dei 3 set",
  fixed3: "3 set obbligatori",
};

/** Versione breve per i pulsanti. */
export const MATCH_FORMAT_SHORT_LABELS: Record<MatchFormat, string> = {
  bo5: "3 set su 5",
  bo3: "2 set su 3",
  fixed3: "3 set fissi",
};

export const DEFAULT_SET_POINTS = 25;
export const DEFAULT_LAST_SET_POINTS = 15;
/** Nel set decisivo le squadre cambiano campo quando una arriva a questo punteggio. */
export const SIDE_CHANGE_POINTS = 8;

/**
 * Regole in vigore nella stagione 2026/2027. Dal 28 settembre 2026 la FIPAV applica in tutte le gare federali, di
 * ogni serie e categoria, le Regole di Gioco FIVB 2025–2028 con le sperimentazioni «FIVB Rule Tests 2026»
 * (documento del Settore Nazionale Ufficiali di Gara «Sperimentazioni regolamentari – Stagione 2026/2027»).
 * Quello che conta per punteggio e formazioni sta qui, in un posto solo: Live score, Scout, guide e manuale lo leggono da qui.
 */
export const RULES_SEASON = "2026/2027";

/** Sostituzioni consentite per set nel 6 contro 6: regola 15.1, da 6 a 8 (restano le limitazioni della regola 15.6). */
export const SUBSTITUTIONS_PER_SET = 8;

/** Time-out a disposizione di ciascuna squadra per set (regola 15.4, invariati). */
export const TIMEOUTS_PER_SET = 2;

/** Durata di ogni time-out richiesto (regola 15.4): 30 secondi. */
export const TIMEOUT_SECONDS = 30;

/** Quanti set al massimo prevede la formula (l'ultimo è il decisivo). */
export function maxSets(format: MatchFormat): number {
  return format === "bo5" ? 5 : 3;
}

/** Set da vincere per aggiudicarsi la partita; null con 3 set obbligatori (si giocano tutti). */
export function setsToWin(format: MatchFormat): number | null {
  if (format === "fixed3") return null;
  return format === "bo5" ? 3 : 2;
}

/** A quanti punti finisce il set `setNumber`: l'ultimo ha il suo limite (di norma 15). */
export function targetForSet(
  rules: { format: MatchFormat; setPoints: number; lastSetPoints: number },
  setNumber: number,
): number {
  return setNumber >= maxSets(rules.format) ? rules.lastSetPoints : rules.setPoints;
}

/** Set vinto: si arriva al limite con almeno due punti di scarto (si prosegue ai vantaggi). */
export function isSetWon(a: number, b: number, target: number): boolean {
  return Math.max(a, b) >= target && Math.abs(a - b) >= 2;
}

/** La squadra che con il prossimo punto vincerebbe il set (null se nessuna). */
export function setPointHolder(a: number, b: number, target: number): "a" | "b" | null {
  if (isSetWon(a, b, target)) return null;
  if (isSetWon(a + 1, b, target)) return "a";
  if (isSetWon(a, b + 1, target)) return "b";
  return null;
}

/** Vero quando i set già chiusi bastano a decidere la partita. */
export function isMatchDecided(format: MatchFormat, setsA: number, setsB: number, closedSets: number): boolean {
  if (format === "fixed3") return closedSets >= 3;
  const needed = setsToWin(format) ?? 3;
  return setsA >= needed || setsB >= needed;
}

/** Il set decisivo è l'ultimo possibile (5° al meglio dei 5, 3° al meglio dei 3); con 3 set obbligatori non c'è. */
export function isDecidingSet(format: MatchFormat, setNumber: number): boolean {
  return format !== "fixed3" && setNumber === maxSets(format);
}

/**
 * Nel set decisivo, la prima volta che una squadra arriva a 8 punti si cambia
 * campo: vero se è il momento e il cambio non è ancora stato fatto.
 */
export function sideChangeDue(
  format: MatchFormat,
  setNumber: number,
  scoreA: number,
  scoreB: number,
  alreadyDone: boolean,
): boolean {
  return !alreadyDone && isDecidingSet(format, setNumber) && Math.max(scoreA, scoreB) >= SIDE_CHANGE_POINTS;
}
