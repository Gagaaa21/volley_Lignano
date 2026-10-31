import { isValid, parseISO } from "date-fns";
import type { PublicLiveScore, PublicPregame } from "@/lib/types";

/**
 * Le fasi della diretta video prima del fischio d'inizio, in base all'orario della partita (vedi PublicPregame):
 * - finché lo staff non preme «Inizia il riscaldamento» nello Scout: la copertina (Lignano contro l'avversaria, la camera non
 *   si vede);
 * - dal tasto a 15 minuti prima: «Riscaldamento in corso»;
 * - da 15 a 5 minuti prima: «Inizio riscaldamento ufficiale»;
 * - da 5 a 1 minuto prima: la presentazione delle squadre con le formazioni;
 * - da 1 minuto prima (anche senza il tasto, se qualcuno se ne dimentica) e dal primo punto: barra e punteggio.
 * Senza l'orario della partita, dopo il tasto resta il riscaldamento fino al primo punto.
 *
 * La calcola il server a ogni lettura del punteggio pubblico: così chi guarda dalla pagina /diretta (che ritarda le letture per
 * stare dietro al video di YouTube) vede cambiare la fase insieme al video, e l'orologio del computer di Streamlabs non conta.
 * Funzioni pure: l'ora arriva da fuori.
 */
export const OFFICIAL_WARMUP_MINUTES = 15;
export const PROTOCOL_MINUTES = 5;
export const MATCH_MINUTES = 1;

const MINUTE = 60_000;

/**
 * L'inizio previsto della partita (ms), o null se non si sa. L'orario è scritto in ora italiana senza fuso («2026-10-31T18:00»)
 * e si legge nell'ora locale: sul server è sempre quella italiana (vedi src/instrumentation.ts).
 */
export function scheduledStart(live: Pick<PublicLiveScore, "info">): number | null {
  if (!live.info?.date) return null;
  const date = parseISO(live.info.date);
  return isValid(date) ? date.getTime() : null;
}

/** La fase prima della partita adesso, o null quando si gioca (barra e punteggio). */
export function pregamePhase(live: Pick<PublicLiveScore, "notStarted" | "warmupAt" | "info">, now: number): PublicPregame | null {
  if (!live.notStarted) return null;
  const start = scheduledStart(live);
  const minutesLeft = start === null ? null : (start - now) / MINUTE;
  if (minutesLeft !== null && minutesLeft <= MATCH_MINUTES) return null;
  if (!live.warmupAt) return "cover";
  if (minutesLeft === null || minutesLeft > OFFICIAL_WARMUP_MINUTES) return "warmup";
  if (minutesLeft > PROTOCOL_MINUTES) return "officialWarmup";
  return "protocol";
}

/**
 * Da quando vale la fase di adesso, quando l'ha decisa l'orario (ms): l'inizio del riscaldamento ufficiale, della presentazione
 * o della barra (1 minuto prima). Null quando l'ha decisa lo staff (copertina e riscaldamento): quel salvataggio ha già la sua ora.
 */
export function phaseStart(live: Pick<PublicLiveScore, "notStarted" | "info">, phase: PublicPregame | null): number | null {
  const start = live.notStarted ? scheduledStart(live) : null;
  if (start === null) return null;
  if (phase === null) return start - MATCH_MINUTES * MINUTE;
  if (phase === "officialWarmup") return start - OFFICIAL_WARMUP_MINUTES * MINUTE;
  if (phase === "protocol") return start - PROTOCOL_MINUTES * MINUTE;
  return null;
}

/**
 * Il punteggio pubblico con la fase di adesso (senza, quando si gioca). Quando la fase cambia per l'orario, `updatedAt` diventa
 * l'ora del cambio (se è dopo l'ultimo salvataggio): la pagina /diretta conta il ritardo del video da `updatedAt` e scarta le
 * letture con la stessa ora (vedi delay.ts), così anche il cambio di fase arriva insieme al video, e non subito o mai.
 */
export function withPregame(live: PublicLiveScore, now: number): PublicLiveScore {
  if (!live.notStarted) return live.pregame ? withoutPregame(live) : live;
  const pregame = pregamePhase(live, now);
  const since = phaseStart(live, pregame);
  const saved = Date.parse(live.updatedAt);
  const updatedAt = since !== null && (!Number.isFinite(saved) || since > saved) ? new Date(since).toISOString() : live.updatedAt;
  if (pregame) return live.pregame === pregame && live.updatedAt === updatedAt ? live : { ...live, pregame, updatedAt };
  if (!live.pregame && live.updatedAt === updatedAt) return live;
  return { ...withoutPregame(live), updatedAt };
}

function withoutPregame(live: PublicLiveScore): PublicLiveScore {
  const rest = { ...live };
  delete rest.pregame;
  return rest;
}

/** Una fase in cui la barra del punteggio non si vede (copertina, riscaldamento, presentazione). */
export const hidesScore = (live: Pick<PublicLiveScore, "pregame"> | null): boolean => Boolean(live?.pregame);

/** Una fase in cui non va in onda nessuna grafica della partita: copertina e riscaldamento (la presentazione sì). */
export const beforeProtocol = (live: Pick<PublicLiveScore, "pregame"> | null): boolean =>
  live?.pregame === "cover" || live?.pregame === "warmup" || live?.pregame === "officialWarmup";
