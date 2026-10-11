/**
 * Scout di una partita: per ogni scambio si segna COME è finito e CHI ha
 * compiuto l'ultima azione, come negli scout dei campionati ufficiali
 * (Data Volley, usato anche da Lega Pallavolo e FIPAV): il punto lo fa chi
 * mette la palla a terra (attacco, muro, ace) o chi subisce un errore/fallo
 * dell'avversaria (Regole di Gioco, regola 6: palla a terra nel campo avversario,
 * fallo o penalizzazione dell'avversaria). Tutto il resto — chi ha il
 * punteggio, a chi tocca battere, break point, cambio palla — si ricava da
 * questa sequenza (vedi derive.ts), così non può mai andare fuori sincrono.
 */

/** «us» = Volley Lignano, «opp» = avversaria: sempre dal nostro punto di vista. */
export type ScoutSide = "us" | "opp";

export function otherSide(side: ScoutSide): ScoutSide {
  return side === "us" ? "opp" : "us";
}

/**
 * Come è finito lo scambio. Si registra l'azione di chi l'ha compiuta:
 * - attack / block / ace: punto per chi li fa (palla a terra nel campo avversario);
 * - tutto il resto sono errori o falli di chi li commette: il punto va all'altra squadra.
 */
export const SCOUT_HOWS = [
  "attack",
  "block",
  "ace",
  "serveError",
  "receptionError",
  "attackError",
  "blockError",
  "setError",
  "digError",
  "netFault",
  "centerLine",
  "doubleContact",
  "heldBall",
  "fourHits",
  "rotationFault",
  "sanction",
] as const;
export type ScoutHow = (typeof SCOUT_HOWS)[number];

/** Una giocatrice a referto. Per noi `id` è l'atleta (o `x-…` se scritta a mano), per l'avversaria `opp-<maglia>`. */
export interface ScoutPlayer {
  id: string;
  name: string;
  /** Numero di maglia, facoltativo per noi, il riferimento per l'avversaria. */
  number: string | null;
  libero: boolean;
}

export interface ScoutRoster {
  us: ScoutPlayer[];
  opp: ScoutPlayer[];
}

/** Formule delle gare regionali FIPAV: al meglio dei 3 set su 5, dei 2 su 3, oppure 3 set obbligatori. */
export type ScoutFormat = "bo5" | "bo3" | "fixed3";

export interface ScoutSettings {
  format: ScoutFormat;
  /** Punti per vincere un set (25) — con almeno due punti di scarto. */
  setPoints: number;
  /** Punti del set decisivo (15; con 3 set obbligatori lo stabilisce il regolamento della gara). */
  lastSetPoints: number;
  /** Chi batte per primo nel 1° set. */
  firstServer: ScoutSide;
  /** Punteggio live sul sito pubblico, acceso a mano: solo squadre, punti e set (risultato non ufficiale), mai nomi né numeri di maglia. */
  publicLive: boolean;
}

export interface ScoutRallyEvent {
  type: "rally";
  id: string;
  /** Istante in cui è stato segnato (ms), per la durata dei set. */
  at: number;
  /** Squadra che ha compiuto l'ultima azione dello scambio. */
  actor: ScoutSide;
  how: ScoutHow;
  /** `ScoutPlayer.id` di chi ha compiuto l'azione, null se non si sa. */
  player: string | null;
  /** Solo per il muro: chi attaccava (squadra opposta a `actor`), se si sa. */
  victim: string | null;
}

export interface ScoutSetEndEvent {
  type: "setEnd";
  id: string;
  at: number;
  /** Chi batte per primo nel set successivo. */
  nextServer: ScoutSide;
}

export type ScoutEvent = ScoutRallyEvent | ScoutSetEndEvent;

export interface ScoutData {
  settings: ScoutSettings;
  roster: ScoutRoster;
  /** In ordine di gioco: l'annulla toglie sempre l'ultimo. */
  events: ScoutEvent[];
  /** Partita chiusa a mano dallo staff (di norma si chiude da sola a set vinti). */
  finished: boolean;
}

/** Scout salvato di una partita (una riga per partita, riservata allo staff). */
export interface MatchScout extends ScoutData {
  matchId: string;
  /** Cresce a ogni salvataggio: chi salva dichiara su quale versione si è basato, così due dispositivi non si sovrascrivono in silenzio. */
  version: number;
  updatedBy: string | null;
  updatedAt: string;
}

export type MatchScoutInput = ScoutData;

/** Esito di un salvataggio: ok, oppure la versione attuale quando nel frattempo qualcun altro ha salvato. */
export type SaveMatchScoutResult = { ok: true; scout: MatchScout } | { ok: false; current: MatchScout | null };
