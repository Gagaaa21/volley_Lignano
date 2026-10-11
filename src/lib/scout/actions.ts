import { deriveScout } from "./derive";
import { rallyWinner } from "./rules";
import {
  otherSide,
  type ScoutData,
  type ScoutEvent,
  type ScoutHow,
  type ScoutPlayer,
  type ScoutRallyEvent,
  type ScoutRoster,
  type ScoutSettings,
  type ScoutSide,
} from "./types";

/**
 * Le operazioni sullo scout come funzioni pure (dati in, dati nuovi fuori):
 * la pagina le usa dentro un reducer, i test le provano da sole. Una
 * operazione non valida (partita già decisa, set in parità, giocatrice
 * inesistente) restituisce gli stessi dati senza cambiarli.
 */

export const DEFAULT_SETTINGS: ScoutSettings = {
  format: "bo5",
  setPoints: 25,
  lastSetPoints: 15,
  firstServer: "us",
};

export function newScoutData(roster: ScoutRoster, settings: Partial<ScoutSettings> = {}): ScoutData {
  return { settings: { ...DEFAULT_SETTINGS, ...settings }, roster, events: [], finished: false };
}

/** Numero di maglia ripulito: solo cifre, al massimo due (come a referto). */
export function cleanNumber(value: string): string | null {
  const digits = value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 2);
  return digits === "" ? null : digits;
}

/** La giocatrice avversaria con quel numero di maglia (si riconosce dall'id, quindi non si duplica). */
export function opponentPlayer(number: string): ScoutPlayer {
  return { id: `opp-${number}`, name: `n. ${number}`, number, libero: false };
}

const MANUAL_PREFIX = "x-";

/** Una giocatrice scritta a mano (non è nel registro atlete): l'id comincia per «x-», `suffix` lo rende unico. */
export function manualPlayer(suffix: string, name: string, number: string | null, libero = false): ScoutPlayer {
  return { id: `${MANUAL_PREFIX}${suffix}`, name: name.trim(), number, libero };
}

export function isManualPlayer(id: string): boolean {
  return id.startsWith(MANUAL_PREFIX);
}

export function findPlayer(roster: ScoutRoster, side: ScoutSide, id: string | null): ScoutPlayer | null {
  if (id === null) return null;
  return roster[side].find((p) => p.id === id) ?? null;
}

/** Id delle giocatrici che compaiono in almeno uno scambio: non si possono togliere dalla rosa. */
export function usedPlayerIds(data: Pick<ScoutData, "events">): Set<string> {
  const used = new Set<string>();
  for (const event of data.events) {
    if (event.type !== "rally") continue;
    if (event.player) used.add(event.player);
    if (event.victim) used.add(event.victim);
  }
  return used;
}

export interface RallyInput {
  actor: ScoutSide;
  how: ScoutHow;
  player: string | null;
  victim?: string | null;
}

/** Toglie i riferimenti a giocatrici che non sono in rosa e il «chi attaccava» dove non ha senso. */
function sanitizeRally(data: ScoutData, input: RallyInput): Pick<ScoutRallyEvent, "actor" | "how" | "player" | "victim"> {
  const player = findPlayer(data.roster, input.actor, input.player ?? null)?.id ?? null;
  const victim =
    input.how === "block" ? (findPlayer(data.roster, otherSide(input.actor), input.victim ?? null)?.id ?? null) : null;
  return { actor: input.actor, how: input.how, player, victim };
}

function isLocked(data: ScoutData): boolean {
  return data.finished || deriveScout(data).decided;
}

export function addRally(data: ScoutData, input: RallyInput, at: number, id: string): ScoutData {
  if (isLocked(data)) return data;
  const event: ScoutRallyEvent = { type: "rally", id, at, ...sanitizeRally(data, input) };
  return { ...data, events: [...data.events, event] };
}

/** Chiude il set in corso (serve almeno un punto e nessuna parità) e dice chi batte per primo nel prossimo. */
export function endSet(data: ScoutData, nextServer: ScoutSide, at: number, id: string): ScoutData {
  if (isLocked(data)) return data;
  const view = deriveScout(data);
  const cur = view.current;
  if (!cur || cur.rallies.length === 0 || cur.score.us === cur.score.opp) return data;
  return { ...data, events: [...data.events, { type: "setEnd", id, at, nextServer }] };
}

/** Annulla l'ultimo evento (un punto o la chiusura di un set) e riapre la partita se era chiusa. */
export function undoLast(data: ScoutData): ScoutData {
  if (data.events.length === 0) return data.finished ? { ...data, finished: false } : data;
  return { ...data, events: data.events.slice(0, -1), finished: false };
}

export function removeEvent(data: ScoutData, id: string): ScoutData {
  if (!data.events.some((e) => e.id === id)) return data;
  return { ...data, events: data.events.filter((e) => e.id !== id), finished: false };
}

/** Corregge uno scambio già segnato (chi, come, a chi); punteggi e battute si ricalcolano da soli. */
export function updateRally(data: ScoutData, id: string, patch: RallyInput): ScoutData {
  const events: ScoutEvent[] = data.events.map((event) =>
    event.type === "rally" && event.id === id ? { ...event, ...sanitizeRally(data, patch) } : event,
  );
  return { ...data, events };
}

export function finishMatch(data: ScoutData): ScoutData {
  return data.finished ? data : { ...data, finished: true };
}

export function reopenMatch(data: ScoutData): ScoutData {
  return data.finished ? { ...data, finished: false } : data;
}

export function updateSettings(data: ScoutData, settings: Partial<ScoutSettings>): ScoutData {
  return { ...data, settings: { ...data.settings, ...settings } };
}

// ── rosa ────────────────────────────────────────────────────────────────

export function addPlayer(data: ScoutData, side: ScoutSide, player: ScoutPlayer): ScoutData {
  if (data.roster[side].some((p) => p.id === player.id)) return data;
  return { ...data, roster: { ...data.roster, [side]: [...data.roster[side], player] } };
}

export function updatePlayer(
  data: ScoutData,
  side: ScoutSide,
  id: string,
  patch: Partial<Pick<ScoutPlayer, "name" | "number" | "libero">>,
): ScoutData {
  return {
    ...data,
    roster: { ...data.roster, [side]: data.roster[side].map((p) => (p.id === id ? { ...p, ...patch } : p)) },
  };
}

/** Si può togliere solo chi non compare in nessuno scambio. */
export function removePlayer(data: ScoutData, side: ScoutSide, id: string): ScoutData {
  if (usedPlayerIds(data).has(id)) return data;
  return { ...data, roster: { ...data.roster, [side]: data.roster[side].filter((p) => p.id !== id) } };
}

/** Chi ha segnato (o subìto) l'ultimo scambio: per il messaggio «Punto a …» dopo ogni tocco. */
export function winnerOf(event: ScoutRallyEvent): ScoutSide {
  return rallyWinner(event.how, event.actor);
}

// ── reducer ─────────────────────────────────────────────────────────────

/** Le operazioni della pagina come azioni di un reducer: stessa funzione pura, un nome per ognuna. */
export type ScoutAction =
  | { type: "replace"; data: ScoutData }
  | { type: "rally"; input: RallyInput; at: number; id: string }
  | { type: "endSet"; nextServer: ScoutSide; at: number; id: string }
  | { type: "undo" }
  | { type: "remove"; id: string }
  | { type: "update"; id: string; patch: RallyInput }
  | { type: "finish" }
  | { type: "reopen" }
  | { type: "settings"; patch: Partial<ScoutSettings> }
  | { type: "addPlayer"; side: ScoutSide; player: ScoutPlayer }
  | { type: "updatePlayer"; side: ScoutSide; id: string; patch: Partial<Pick<ScoutPlayer, "name" | "number" | "libero">> }
  | { type: "removePlayer"; side: ScoutSide; id: string };

export function scoutReducer(data: ScoutData, action: ScoutAction): ScoutData {
  switch (action.type) {
    case "replace":
      return action.data;
    case "rally":
      return addRally(data, action.input, action.at, action.id);
    case "endSet":
      return endSet(data, action.nextServer, action.at, action.id);
    case "undo":
      return undoLast(data);
    case "remove":
      return removeEvent(data, action.id);
    case "update":
      return updateRally(data, action.id, action.patch);
    case "finish":
      return finishMatch(data);
    case "reopen":
      return reopenMatch(data);
    case "settings":
      return updateSettings(data, action.patch);
    case "addPlayer":
      return addPlayer(data, action.side, action.player);
    case "updatePlayer":
      return updatePlayer(data, action.side, action.id, action.patch);
    case "removePlayer":
      return removePlayer(data, action.side, action.id);
  }
}
