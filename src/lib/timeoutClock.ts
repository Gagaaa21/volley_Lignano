import { TIMEOUT_SECONDS } from "@/lib/volleyRules";

/**
 * Il conto alla rovescia di un time-out nel Live score: ogni time-out dura 30
 * secondi (regola 15.4, vedi TIMEOUT_SECONDS in volleyRules.ts). Qui solo i
 * conti, senza React e senza orologio proprio: si passa sempre l'ora (`now`,
 * come Date.now()), così si provano da soli e restano giusti anche se la
 * pagina resta in secondo piano e il timer rallenta.
 */

/** Un time-out in corso. */
export interface TimeoutRun {
  /** Chi l'ha chiesto (A o B, come nel tabellone). */
  team: "A" | "B";
  /** Il numero del time-out nel set: 1° o 2°. */
  nth: number;
  /** Quando è partito e quando finisce (millisecondi). */
  startedAt: number;
  endsAt: number;
  /** Punti segnati in tutto (A + B) quando è partito: se cambiano, il gioco è ripreso e il time-out è finito. */
  points: number;
}

export const TIMEOUT_MS = TIMEOUT_SECONDS * 1000;
/** Negli ultimi secondi il conto cambia colore. */
export const TIMEOUT_WARNING_SECONDS = 10;
/** Finito il conto, il riquadro resta ancora un po' (millisecondi) e poi si chiude da solo. */
export const TIMEOUT_LINGER_MS = 8000;

export type TimeoutPhase = "running" | "warning" | "over";

/** L'ora di adesso (Date.now): si chiama solo da un tocco, mai mentre la pagina si disegna. */
export function nowMs(): number {
  return Date.now();
}

export function startTimeoutRun(team: "A" | "B", nth: number, points: number, now: number): TimeoutRun {
  return { team, nth, startedAt: now, endsAt: now + TIMEOUT_MS, points };
}

/** Secondi che mancano, arrotondati per eccesso (a 29,2 s dal via si vede 30, come in un vero cronometro che scende); mai meno di zero. */
export function secondsLeft(run: TimeoutRun, now: number): number {
  return Math.max(0, Math.ceil((run.endsAt - now) / 1000));
}

/** Quanta parte del tempo resta, da 1 (appena partito) a 0 (finito): serve alla barra. */
export function fractionLeft(run: TimeoutRun, now: number): number {
  const total = run.endsAt - run.startedAt;
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, (run.endsAt - now) / total));
}

export function timeoutPhase(run: TimeoutRun, now: number): TimeoutPhase {
  if (now >= run.endsAt) return "over";
  return secondsLeft(run, now) <= TIMEOUT_WARNING_SECONDS ? "warning" : "running";
}

/** Vero quando il riquadro può sparire da solo: il time-out è finito da un po'. */
export function isTimeoutForgotten(run: TimeoutRun, now: number): boolean {
  return now >= run.endsAt + TIMEOUT_LINGER_MS;
}

/** «0:30», «0:07»: minuti e secondi, come sul tabellone. */
export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
