import { currentServer, type ScoutView } from "./derive";
import type { ScoutLevel, ScoutSide } from "./types";

/**
 * A che punto è lo scambio: se la nostra ricezione è da segnare (livello «Con
 * ricezioni») e da che parte del campo è la palla.
 */

/** La nostra ricezione è da segnare: battono loro e non l'abbiamo ancora segnata (livello «Con ricezioni»). */
export function receptionOpen(view: ScoutView): boolean {
  return currentServer(view) === "opp" && !view.pending.some((t) => t.skill === "reception" && t.side === "us");
}

/** Dove sta la palla adesso: da che parte del campo e che fase si sta giocando. */
export interface BallState {
  /** Da che parte della rete è la palla. */
  side: ScoutSide;
  /** Cosa si sta giocando: «Battuta», «Ricezione», «Attacco»… */
  phase: string;
  /** Da che parte arriva, se ha appena passato la rete (per mostrarlo). */
  from: ScoutSide | null;
}

/**
 * Da che parte del campo è la palla. Non si segue ogni tocco: si sa solo che a
 * inizio scambio è dalla parte di chi batte e che, segnata la nostra ricezione
 * (livello «Con ricezioni»), è nostra. Null se la partita è finita.
 */
export function ballOf(view: ScoutView, level: ScoutLevel): BallState | null {
  if (view.decided) return null;
  const server = currentServer(view);
  if (!server) return null;
  if (level === "ricezioni" && server === "opp" && view.pending.some((t) => t.skill === "reception" && t.side === "us")) {
    return { side: "us", phase: "In gioco", from: "opp" };
  }
  return { side: server, phase: "Battuta", from: null };
}
