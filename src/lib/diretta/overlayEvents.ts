import type { PublicLiveScore } from "@/lib/types";
import { TIMEOUT_SECONDS } from "@/lib/volleyRules";

/**
 * La logica della grafica della diretta video (pagina /diretta/grafica, che OBS mette sopra il video): cosa è cambiato
 * tra due letture del punteggio pubblico e quale scheda va aperta sotto la barra. Funzioni pure, senza orologio né rete:
 * l'ora arriva da fuori, così si provano da sole.
 */

/** La pagina che OBS usa come «Sorgente browser». */
export const OVERLAY_PATH = "/diretta/grafica";

/** Come la pagina /diretta e la grafica che sta nel suo riquadro si parlano (stessa origine): `{ type, ritardo?, scala? }` verso la grafica… */
export const OPTIONS_MESSAGE = "vl-opzioni";
/** …e questo, dalla grafica alla pagina, quando è pronta ad ascoltare (un messaggio mandato prima andrebbe perso). */
export const READY_MESSAGE = "vl-grafica-pronta";

export type Side = "home" | "away";

/** Quanto resta aperta ogni scheda sotto la barra del punteggio. */
export const TIMEOUT_CARD_MS = TIMEOUT_SECONDS * 1000;
export const SET_CARD_MS = 9_000;
export const FINAL_CARD_MS = 30_000;

export interface OverlayChange {
  /** Le squadre che hanno chiamato un time-out tra le due letture. */
  timeouts: Side[];
  /** Il set chiuso tra le due letture (l'ultimo, se sono più di uno). */
  setEnded: { n: number; home: number; away: number } | null;
  /** La partita è finita adesso. */
  matchEnded: boolean;
}

const NOTHING: OverlayChange = { timeouts: [], setEnded: null, matchEnded: false };

/**
 * Le due letture sono della stessa partita? Se cambia l'avversaria o i set tornano indietro (un'altra partita, o la prova
 * che ricomincia) non ci sono cambiamenti da annunciare: sarebbero animazioni «fantasma».
 */
function sameMatch(prev: PublicLiveScore, next: PublicLiveScore): boolean {
  return prev.team === next.team && prev.category === next.category && prev.away.name === next.away.name && next.sets.length >= prev.sets.length;
}

/** Cosa è cambiato da `prev` a `next`. Alla prima lettura (o dopo un «niente») non è cambiato niente. */
export function diffLive(prev: PublicLiveScore | null, next: PublicLiveScore | null): OverlayChange {
  if (!prev || !next || !sameMatch(prev, next)) return NOTHING;
  const timeouts: Side[] = [];
  // I time-out sono quelli del set in corso: cambiando set tornano a zero, e non è un time-out nuovo.
  if (prev.sets.length === next.sets.length) {
    if (next.timeouts.home > prev.timeouts.home) timeouts.push("home");
    if (next.timeouts.away > prev.timeouts.away) timeouts.push("away");
  }
  const last = next.sets[next.sets.length - 1];
  return {
    timeouts,
    setEnded: next.sets.length > prev.sets.length && last ? { n: next.sets.length, home: last.home, away: last.away } : null,
    matchEnded: !prev.finished && next.finished,
  };
}

/** La scheda che si apre sotto la barra del punteggio (o sopra, se la barra sta in basso). */
export type Card =
  | { kind: "timeout"; side: Side; startedAt: number; until: number }
  | { kind: "set"; n: number; home: number; away: number; startedAt: number; until: number }
  | { kind: "final"; startedAt: number; until: number };

/** Se arrivano due eventi insieme resta il più importante: la fine della partita non si copre con un time-out. */
const RANK: Record<Card["kind"], number> = { timeout: 1, set: 2, final: 3 };

export interface Feed {
  live: PublicLiveScore | null;
  card: Card | null;
  /** L'ultimo istante noto (ms): serve a chiudere le schede scadute e al conto alla rovescia. */
  now: number;
}

export const INITIAL_FEED: Feed = { live: null, card: null, now: 0 };

export type FeedAction = { type: "poll"; live: PublicLiveScore | null; now: number } | { type: "tick"; now: number };

const stillOpen = (card: Card | null, now: number): Card | null => (card && now < card.until ? card : null);

export function feedReducer(feed: Feed, action: FeedAction): Feed {
  const open = stillOpen(feed.card, action.now);
  if (action.type === "tick") return open === feed.card && action.now === feed.now ? feed : { ...feed, card: open, now: action.now };

  const { live, now } = action;
  // Nessuna partita in diretta: via anche le schede.
  if (!live) return { live: null, card: null, now };

  const change = diffLive(feed.live, live);
  let card = open;
  const offer = (next: Card) => {
    if (!card || RANK[next.kind] >= RANK[card.kind]) card = next;
  };
  if (change.timeouts.length > 0) {
    offer({ kind: "timeout", side: change.timeouts[change.timeouts.length - 1], startedAt: now, until: now + TIMEOUT_CARD_MS });
  }
  if (change.setEnded) offer({ kind: "set", ...change.setEnded, startedAt: now, until: now + SET_CARD_MS });
  if (change.matchEnded) offer({ kind: "final", startedAt: now, until: now + FINAL_CARD_MS });
  return { live, card, now };
}

/** Secondi che mancano alla fine della scheda, arrotondati per eccesso (mai sotto zero). */
export function secondsLeft(card: Card, now: number): number {
  return Math.max(0, Math.ceil((card.until - now) / 1000));
}
