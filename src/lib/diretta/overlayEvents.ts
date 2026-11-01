import { beforeProtocol } from "@/lib/diretta/pregame";
import type { PublicLineup, PublicLiveScore, PublicSetRecap, PublicSetRecapTeam, PublicSubstitution } from "@/lib/types";
import { TIMEOUT_SECONDS } from "@/lib/volleyRules";

/**
 * La logica della grafica della diretta video (pagina /diretta/grafica, che OBS mette sopra il video): cosa è cambiato
 * tra due letture del punteggio pubblico e quali grafiche vanno in onda, come in una regia di Serie A:
 * - a schermo intero (con la transizione): presentazione della partita, formazione di partenza, fine set, risultato finale;
 * - in basso a sinistra (sottopancia): time-out con il conto alla rovescia e i numeri del set (esce da solo al primo punto
 *   dopo: si è ripreso a giocare); cambio, sopra il time-out se capitano insieme (succede spesso: si cambia durante il
 *   time-out); i momenti del set: «Il set fin qui» a 8 e 16 di chi è avanti nei set lunghi (i vecchi time-out tecnici) e il
 *   cambio di campo a metà del set decisivo.
 * Le grafiche a schermo intero vanno in onda una alla volta, in coda (presentazione → formazione, fine set → formazione del
 * set dopo); i cambi pure, tra loro. Funzioni pure, senza orologio né rete: l'ora arriva da fuori, così si provano da sole.
 */

/** La pagina che OBS usa come «Sorgente browser». */
export const OVERLAY_PATH = "/diretta/grafica";

/** Come la pagina /diretta e la grafica che sta nel suo riquadro si parlano (stessa origine): `{ type, ritardo?, scala? }` verso la grafica… */
export const OPTIONS_MESSAGE = "vl-opzioni";
/** …e questo, dalla grafica alla pagina, quando è pronta ad ascoltare (un messaggio mandato prima andrebbe perso). */
export const READY_MESSAGE = "vl-grafica-pronta";

export type Side = "home" | "away";

/** Quanto resta in onda ogni grafica. */
export const TIMEOUT_CARD_MS = TIMEOUT_SECONDS * 1000;
export const SUB_CARD_MS = 8_000;
/** I numeri del set a metà strada («Il set fin qui»). */
export const STATS_CARD_MS = 9_000;
/** Il cambio di campo nel set decisivo. */
export const COURT_CARD_MS = 10_000;
/** Gli ultimi istanti un sottopancia si richiude, invece di sparire di colpo: anche quando esce prima (si è ripreso a giocare). */
export const STRIP_OUT_MS = 450;
/** A quanti punti di chi è avanti si mostrano i numeri del set, nei set a 25 (i vecchi time-out tecnici). */
export const STATS_MARKS = [8, 16] as const;
export const INTRO_CARD_MS = 12_000;
export const LINEUP_CARD_MS = 12_000;
export const SET_CARD_MS = 9_000;
/** Con il resoconto del set (i numeri di squadra) serve più tempo per leggerlo. */
export const SET_RECAP_MS = 15_000;
export const FINAL_CARD_MS = 30_000;
/** La copertina resta finché non comincia il riscaldamento (o la partita): abbastanza per qualunque attesa. */
export const COVER_CARD_MS = 12 * 60 * 60 * 1000;
/** Da quanti punti di fila si mostra la serie in corso sotto la barra («Parziale 4-0»): il punteggio pubblico la porta da lì. */
export const RUN_MIN = 4;
/** Quanto dura l'uscita di una grafica a schermo intero (la transizione): una che non serve più esce in questo tempo. */
export const FULL_EXIT_MS = 800;
/** Quanti cambi stanno insieme in un sottopancia (un cambio doppio o triplo è una grafica sola). */
export const SUBS_PER_CARD = 3;
/** Al più tante grafiche in coda: oltre, le più vecchie non servono più. */
const QUEUE_MAX = 4;

export interface OverlayChange {
  /** Le squadre che hanno chiamato un time-out tra le due letture. */
  timeouts: Side[];
  /** Il set chiuso tra le due letture (l'ultimo, se sono più di uno). */
  setEnded: { n: number; home: number; away: number } | null;
  /** La partita è finita adesso. */
  matchEnded: boolean;
  /** I nostri cambi nuovi, in ordine. */
  subs: PublicSubstitution[];
  /** La formazione da presentare: quella di un set nuovo, scritta a 0–0. */
  lineup: PublicLineup | null;
  /** È cominciata la presentazione (da 5 minuti prima del fischio d'inizio, vedi pregame.ts): squadre e formazione. */
  intro: boolean;
  /** Si è passati alla copertina (prima del riscaldamento): copre tutto, la camera non si vede. */
  cover: boolean;
  /** Chi è avanti è arrivato a 8 o a 16 in un set a 25: i numeri del set («Il set fin qui»). Il punteggio raggiunto, o null. */
  statsAt: number | null;
  /** Set decisivo: chi è avanti è arrivato a metà (8 su 15), si cambia campo. Il punteggio raggiunto, o null. */
  courtChange: number | null;
}

const NOTHING: OverlayChange = { timeouts: [], setEnded: null, matchEnded: false, subs: [], lineup: null, intro: false, cover: false, statsAt: null, courtChange: null };

/**
 * Le due letture sono della stessa partita? Se cambia l'avversaria o i set tornano indietro (un'altra partita, o la prova
 * che ricomincia) non ci sono cambiamenti da annunciare: sarebbero animazioni «fantasma».
 */
function sameMatch(prev: PublicLiveScore, next: PublicLiveScore): boolean {
  return prev.team === next.team && prev.category === next.category && prev.away.name === next.away.name && next.sets.length >= prev.sets.length;
}

/** Il set in corso è ancora a 0–0 (e la partita non è finita): l'unico momento in cui si presenta una formazione. */
const atZero = (live: PublicLiveScore) => !live.finished && live.home.score === 0 && live.away.score === 0;

/** La presentazione prima del fischio d'inizio (da 5 minuti prima, vedi pregame.ts). */
const presenting = (live: PublicLiveScore | null) => Boolean(live?.notStarted) && live?.pregame === "protocol";

/**
 * Cosa è cambiato da `prev` a `next`. Alla prima lettura (o dopo un «niente») non è cambiato niente, con un'eccezione: durante
 * la presentazione (da 5 a 1 minuto prima del fischio d'inizio) le squadre e la formazione vanno in onda lo stesso. Così chi
 * apre OBS in quel momento le vede; chi lo riapre a partita in corso non si ritrova a schermo intero una grafica vecchia.
 * Durante copertina e riscaldamento non va in onda niente: nemmeno una formazione scritta intanto nello Scout.
 */
export function diffLive(prev: PublicLiveScore | null, next: PublicLiveScore | null): OverlayChange {
  if (!next) return NOTHING;
  if (!prev || !sameMatch(prev, next)) {
    if (next.pregame === "cover") return { ...NOTHING, cover: true };
    if (!presenting(next)) return NOTHING;
    return { ...NOTHING, intro: true, lineup: next.lineup && atZero(next) ? next.lineup : null };
  }
  if (beforeProtocol(next)) return { ...NOTHING, cover: next.pregame === "cover" && prev.pregame !== "cover" };
  // Comincia la presentazione: le squadre, e poi la formazione se c'è già.
  if (presenting(next) && !presenting(prev)) {
    return { ...NOTHING, intro: true, lineup: next.lineup && atZero(next) ? next.lineup : null };
  }
  const timeouts: Side[] = [];
  // I time-out sono quelli del set in corso: cambiando set tornano a zero, e non è un time-out nuovo.
  if (prev.sets.length === next.sets.length) {
    if (next.timeouts.home > prev.timeouts.home) timeouts.push("home");
    if (next.timeouts.away > prev.timeouts.away) timeouts.push("away");
  }
  // I momenti del set, a punteggio che sale nello stesso set: i numeri a 8 e 16 di chi è avanti nei set a 25, il cambio di
  // campo a metà del set decisivo.
  let statsAt: number | null = null;
  let courtChange: number | null = null;
  const rules = next.setRules;
  if (rules && prev.sets.length === next.sets.length && !next.finished) {
    const before = Math.max(prev.home.score, prev.away.score);
    const after = Math.max(next.home.score, next.away.score);
    if (rules.deciding) {
      const half = Math.ceil(rules.target / 2);
      if (before < half && after >= half) courtChange = half;
    } else if (rules.target >= 25) {
      statsAt = STATS_MARKS.find((mark) => before < mark && after >= mark) ?? null;
    }
  }
  const last = next.sets[next.sets.length - 1];
  const known = new Set((prev.subs ?? []).map((sub) => sub.id));
  const subs = (next.subs ?? []).filter((sub) => !known.has(sub.id));
  // La formazione si presenta quando compare per un set che prima non l'aveva, a 0–0 (non le correzioni successive).
  const lineup = next.lineup && atZero(next) && prev.lineup?.set !== next.lineup.set ? next.lineup : null;
  return {
    timeouts,
    setEnded: next.sets.length > prev.sets.length && last ? { n: next.sets.length, home: last.home, away: last.away } : null,
    matchEnded: !prev.finished && next.finished,
    subs,
    lineup,
    intro: false,
    cover: false,
    statsAt,
    courtChange,
  };
}

/** Una grafica a schermo intero. `startedAt`/`until` si fissano quando va in onda (in coda valgono 0). */
export type FullCard =
  | { kind: "cover"; startedAt: number; until: number }
  | { kind: "intro"; startedAt: number; until: number }
  | { kind: "lineup"; lineup: PublicLineup; startedAt: number; until: number }
  | { kind: "set"; n: number; home: number; away: number; recap?: PublicSetRecap; startedAt: number; until: number }
  | {
      kind: "final";
      recap?: PublicSetRecap;
      stats?: { home: PublicSetRecapTeam; away: PublicSetRecapTeam };
      startedAt: number;
      until: number;
    };

/** I sottopancia, in basso a sinistra: il time-out (`count`: il 1° o il 2° di quella squadra nel set), il cambio e i momenti del set. */
export type TimeoutCard = { kind: "timeout"; side: Side; count: number; stats?: { home: PublicSetRecapTeam; away: PublicSetRecapTeam }; startedAt: number; until: number };
export type SubCard = { kind: "sub"; subs: PublicSubstitution[]; startedAt: number; until: number };
export type StatsCard = { kind: "stats"; set: number; stats: { home: PublicSetRecapTeam; away: PublicSetRecapTeam }; startedAt: number; until: number };
export type CourtCard = { kind: "court"; at: number; score: { home: number; away: number }; startedAt: number; until: number };
/** Un momento del set: uno alla volta, il nuovo prende il posto del vecchio. */
export type MomentCard = StatsCard | CourtCard;
export type StripCard = TimeoutCard | SubCard | MomentCard;

/** Per compatibilità con le schede di prima: qualunque grafica in onda. */
export type Card = FullCard | StripCard;

export interface Feed {
  live: PublicLiveScore | null;
  /** La grafica a schermo intero in onda, e quelle che aspettano. */
  full: FullCard | null;
  fullQueue: FullCard[];
  /** Il time-out in onda (uno solo: il nuovo prende il posto del vecchio). */
  timeout: TimeoutCard | null;
  /** Il cambio in onda, e quelli che aspettano. */
  sub: SubCard | null;
  subQueue: SubCard[];
  /** Il momento del set in onda («Il set fin qui», cambio di campo). */
  moment: MomentCard | null;
  /** L'ultimo istante noto (ms): serve a chiudere le grafiche scadute e al conto alla rovescia. */
  now: number;
}

export const INITIAL_FEED: Feed = { live: null, full: null, fullQueue: [], timeout: null, sub: null, subQueue: [], moment: null, now: 0 };

export type FeedAction = { type: "poll"; live: PublicLiveScore | null; now: number } | { type: "tick"; now: number };

function durationOf(card: FullCard | StripCard): number {
  switch (card.kind) {
    case "cover":
      return COVER_CARD_MS;
    case "intro":
      return INTRO_CARD_MS;
    case "lineup":
      return LINEUP_CARD_MS;
    case "set":
      return card.recap ? SET_RECAP_MS : SET_CARD_MS;
    case "final":
      return FINAL_CARD_MS;
    case "timeout":
      return TIMEOUT_CARD_MS;
    case "sub":
      return SUB_CARD_MS;
    case "stats":
      return STATS_CARD_MS;
    case "court":
      return COURT_CARD_MS;
  }
}

/** La stessa grafica, in onda da adesso. */
function onAir<T extends FullCard | StripCard>(card: T, now: number): T {
  return { ...card, startedAt: now, until: now + durationOf(card) };
}

/**
 * Una grafica in coda che non ha più senso quando arriva il suo turno: la presentazione a partita cominciata, la formazione
 * di un set già iniziato (o di un altro set), un fine set quando ormai è finita la partita.
 */
function stale(card: FullCard, live: PublicLiveScore | null): boolean {
  if (!live) return true;
  if (card.kind === "cover") return live.pregame !== "cover";
  // Si torna alla copertina o al riscaldamento (lo staff ha tolto il tasto): niente presentazione né formazione.
  if (beforeProtocol(live) && (card.kind === "intro" || card.kind === "lineup")) return true;
  if (card.kind === "intro") return !live.notStarted;
  if (card.kind === "lineup") return !atZero(live) || live.lineup?.set !== card.lineup.set;
  if (card.kind === "set") return live.finished;
  return false;
}

/** Fa avanzare le code: chiude le grafiche scadute e manda in onda le prossime. */
function advance(feed: Feed, now: number): Feed {
  let { full, fullQueue, timeout, sub, subQueue, moment } = feed;
  if (full && now >= full.until) full = null;
  while (!full && fullQueue.length > 0) {
    const [next, ...rest] = fullQueue;
    fullQueue = rest;
    // Una formazione in coda va in onda con le correzioni fatte nel frattempo.
    if (!stale(next, feed.live)) full = onAir(next.kind === "lineup" && feed.live?.lineup ? { ...next, lineup: feed.live.lineup } : next, now);
  }
  if (timeout && now >= timeout.until) timeout = null;
  if (moment && now >= moment.until) moment = null;
  if (sub && now >= sub.until) sub = null;
  if (!sub && subQueue.length > 0) {
    const [next, ...rest] = subQueue;
    subQueue = rest;
    sub = onAir(next, now);
  }
  if (
    full === feed.full &&
    fullQueue === feed.fullQueue &&
    timeout === feed.timeout &&
    sub === feed.sub &&
    subQueue === feed.subQueue &&
    moment === feed.moment &&
    now === feed.now
  ) {
    return feed;
  }
  return { ...feed, full, fullQueue, timeout, sub, subQueue, moment, now };
}

const enqueue = <T>(queue: T[], card: T): T[] => [...queue, card].slice(-QUEUE_MAX);

export function feedReducer(feed: Feed, action: FeedAction): Feed {
  if (action.type === "tick") return advance(feed, action.now);

  const { live, now } = action;
  // Nessuna partita in diretta: via anche le grafiche.
  if (!live) return { ...INITIAL_FEED, now };

  const change = diffLive(feed.live, live);
  let { full, fullQueue, timeout, sub, subQueue, moment } = feed;

  // Si è ripreso a giocare (un punto in più, o un set nuovo): il time-out e i numeri a metà set escono subito, con la tendina.
  // Il conto alla rovescia dice quanto manca, ma in campo il time-out può finire prima (o essere segnato in ritardo).
  const prev = feed.live;
  const resumed =
    prev !== null &&
    sameMatch(prev, live) &&
    (live.sets.length > prev.sets.length || live.home.score + live.away.score > prev.home.score + prev.away.score);
  const leave = <T extends StripCard>(card: T | null): T | null => (card && card.until > now + STRIP_OUT_MS ? { ...card, until: now + STRIP_OUT_MS } : card);
  if (resumed) {
    timeout = leave(timeout);
    if (moment?.kind === "stats") moment = leave(moment);
  }

  // La formazione in onda segue le correzioni fatte nel frattempo (stesso set, ancora a 0–0).
  if (full?.kind === "lineup" && live.lineup?.set === full.lineup.set && atZero(live)) full = { ...full, lineup: live.lineup };
  // Una grafica in onda che non serve più (la presentazione o la formazione quando si comincia a giocare) esce subito, con la
  // sua transizione: non copre il primo scambio.
  if (full && full.kind !== "final" && stale(full, live) && full.until > now + FULL_EXIT_MS) full = { ...full, until: now + FULL_EXIT_MS };

  // La copertina prende il posto di tutto: prima del riscaldamento la camera non si vede.
  if (change.cover) {
    full = onAir({ kind: "cover", startedAt: 0, until: 0 }, now);
    fullQueue = [];
    timeout = null;
    sub = null;
    subQueue = [];
    moment = null;
  } else if (change.matchEnded) {
    // A schermo intero: la fine della partita prende il posto di tutto (anche del fine set appena arrivato con lei).
    const final: FullCard = {
      kind: "final",
      ...(live.recap ? { recap: live.recap } : {}),
      ...(live.matchStats ? { stats: live.matchStats } : {}),
      startedAt: 0,
      until: 0,
    };
    full = onAir(final, now);
    fullQueue = [];
    timeout = null;
    sub = null;
    subQueue = [];
    moment = null;
  } else {
    const queued: FullCard[] = [];
    if (change.intro) queued.push({ kind: "intro", startedAt: 0, until: 0 });
    if (change.setEnded) {
      // Il resoconto vale solo se è quello del set appena chiuso (un altro, o nessuno col Live score: resta il fine set semplice).
      const recap = live.recap && live.recap.n === change.setEnded.n ? live.recap : undefined;
      queued.push({ kind: "set", ...change.setEnded, ...(recap ? { recap } : {}), startedAt: 0, until: 0 });
    }
    if (change.lineup) queued.push({ kind: "lineup", lineup: change.lineup, startedAt: 0, until: 0 });
    for (const card of queued) fullQueue = enqueue(fullQueue, card);

    // In basso a sinistra: il time-out subito (il conto alla rovescia non aspetta), i cambi in coda tra loro.
    if (change.timeouts.length > 0) {
      const side = change.timeouts[change.timeouts.length - 1];
      timeout = onAir({ kind: "timeout", side, count: live.timeouts[side], ...(live.setStats ? { stats: live.setStats } : {}), startedAt: 0, until: 0 }, now);
    }
    // I momenti del set: il cambio di campo prima di tutto; i numeri a metà set solo se non c'è già il time-out (li mostra lui).
    const timeoutOn = timeout !== null && timeout.until > now + STRIP_OUT_MS;
    if (change.courtChange) {
      moment = onAir({ kind: "court", at: change.courtChange, score: { home: live.home.score, away: live.away.score }, startedAt: 0, until: 0 }, now);
    } else if (change.statsAt && live.setStats && !timeoutOn) {
      moment = onAir({ kind: "stats", set: live.sets.length + 1, stats: live.setStats, startedAt: 0, until: 0 }, now);
    }
    for (let i = 0; i < change.subs.length; i += SUBS_PER_CARD) {
      subQueue = enqueue(subQueue, { kind: "sub", subs: change.subs.slice(i, i + SUBS_PER_CARD), startedAt: 0, until: 0 });
    }
  }

  return advance({ live, full, fullQueue, timeout, sub, subQueue, moment, now: feed.now }, now);
}

/** Secondi che mancano alla fine della grafica, arrotondati per eccesso (mai sotto zero). */
export function secondsLeft(card: { until: number }, now: number): number {
  return Math.max(0, Math.ceil((card.until - now) / 1000));
}

/** «Ai vantaggi»: pari a un punto dalla fine del set o oltre (24–24 nei set a 25, 14–14 nel tie-break), senza set point. */
export function atDeuce(live: PublicLiveScore): boolean {
  const rules = live.setRules;
  if (!rules || live.finished || live.point || live.notStarted) return false;
  return live.home.score === live.away.score && live.home.score >= rules.target - 1;
}

/** Il set in corso come lo dice la barra: «Tie-break» nel decisivo, altrimenti «2° set»; «Finale» a partita finita. */
export function phaseLabel(live: PublicLiveScore): string {
  if (live.finished) return "Finale";
  return live.setRules?.deciding ? "Tie-break" : `${live.sets.length + 1}° set`;
}

/** I secondi del time-out che mancano (30 → 0), dall'istante in cui è andato in onda: non saltano a zero se esce prima. */
export function timeoutSecondsLeft(card: { startedAt: number }, now: number): number {
  return Math.max(0, Math.ceil((card.startedAt + TIMEOUT_CARD_MS - now) / 1000));
}
