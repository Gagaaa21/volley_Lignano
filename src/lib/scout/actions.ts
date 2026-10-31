import { TIMEOUTS_PER_SET } from "@/lib/volleyRules";
import { deriveScout } from "./derive";
import { levelOf } from "./levels";
import { rallyWinner } from "./rules";
import { endsRally } from "./touches";
import {
  otherSide,
  SCOUT_GRADES,
  SCOUT_TOUCH_SKILLS,
  type ScoutData,
  type ScoutEvent,
  type ScoutGrade,
  type ScoutHow,
  type ScoutLineupEvent,
  type ScoutPlayer,
  type ScoutRallyEvent,
  type ScoutRoster,
  type ScoutSettings,
  type ScoutSide,
  type ScoutSubEvent,
  type ScoutTouchEvent,
  type ScoutTouchSkill,
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
  publicLive: false,
  publicNames: false,
  warmupAt: null,
  level: "base",
};

/** Impostazioni complete anche per uno scout salvato prima che esistessero i livelli (o il punteggio live). */
export function normalizeSettings(settings: Omit<ScoutSettings, "publicLive" | "level"> & Partial<Pick<ScoutSettings, "publicLive" | "level">>): ScoutSettings {
  return { ...settings, publicLive: settings.publicLive ?? false, level: levelOf(settings) };
}

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
    if (event.type === "setEnd") continue;
    if (event.type === "lineup") {
      for (const id of [...event.positions, event.libero, ...event.hosts]) if (id) used.add(id);
      continue;
    }
    if (event.type === "sub") {
      used.add(event.player);
      continue;
    }
    if (event.type === "timeout" || event.type === "rotate" || event.type === "libero") continue;
    if (event.player) used.add(event.player);
    if (event.type === "rally" && event.victim) used.add(event.victim);
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

/**
 * Quello che «Annulla ultimo» toglierebbe (la posizione nell'elenco), o null se non c'è niente da togliere: l'ultimo evento
 * che non è una formazione. Le formazioni non si annullano mai così (si cambiano dalla loro scheda, o con «Non seguire la
 * formazione»): un tocco per sbaglio subito dopo averle scritte non deve cancellare il lavoro di preparazione. Se le ultime
 * cose segnate sono le formazioni di un set appena cominciato non c'è niente da annullare: togliere la chiusura del set che
 * sta prima le farebbe diventare una correzione del set precedente.
 */
export function undoTarget(data: ScoutData): number | null {
  let index = data.events.length - 1;
  while (index >= 0 && data.events[index].type === "lineup") index--;
  if (index < 0) return null;
  if (index < data.events.length - 1 && data.events[index].type === "setEnd") return null;
  return index;
}

/** Annulla l'ultimo evento che non è una formazione (un punto, un tocco, un cambio, un time-out, la chiusura di un set) e riapre la partita se era chiusa. */
export function undoLast(data: ScoutData): ScoutData {
  const index = undoTarget(data);
  if (index === null) return data.finished ? { ...data, finished: false } : data;
  return { ...data, events: data.events.filter((_, i) => i !== index), finished: false };
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

// ── tocchi ──────────────────────────────────────────────────────────────

export interface TouchInput {
  side: ScoutSide;
  skill: ScoutTouchSkill;
  player: string | null;
  grade: ScoutGrade;
  zone?: number | null;
}

/** Zona del campo valida (da 1 a 6), altrimenti null. */
export function cleanZone(zone: number | null | undefined): number | null {
  return typeof zone === "number" && Number.isInteger(zone) && zone >= 1 && zone <= 6 ? zone : null;
}

/** Toglie i riferimenti a giocatrici che non sono in rosa e le zone che non esistono. */
function sanitizeTouch(data: ScoutData, input: TouchInput): Pick<ScoutTouchEvent, "side" | "skill" | "player" | "grade" | "zone"> {
  const valid = SCOUT_TOUCH_SKILLS.includes(input.skill) && SCOUT_GRADES.includes(input.grade);
  return {
    side: input.side,
    skill: valid ? input.skill : "reception",
    player: findPlayer(data.roster, input.side, input.player ?? null)?.id ?? null,
    grade: valid ? input.grade : "!",
    zone: cleanZone(input.zone),
  };
}

/** Segna un tocco: se il suo voto chiude lo scambio, il punto si assegna da solo (vedi touches.ts). */
export function addTouch(data: ScoutData, input: TouchInput, at: number, id: string): ScoutData {
  if (isLocked(data)) return data;
  if (!SCOUT_TOUCH_SKILLS.includes(input.skill) || !SCOUT_GRADES.includes(input.grade)) return data;
  const event: ScoutTouchEvent = { type: "touch", id, at, ...sanitizeTouch(data, input) };
  return { ...data, events: [...data.events, event] };
}

/**
 * Corregge un tocco già segnato (chi, voto, zona). Il fondamentale e la squadra
 * non cambiano: per quelli si toglie e si rifà. Il voto cambia solo tra voti
 * che hanno lo stesso effetto sullo scambio (che lo chiudono entrambi o che
 * non lo chiudono): trasformare un tocco qualunque in un punto sposterebbe
 * gli scambi che seguono.
 */
export function updateTouch(data: ScoutData, id: string, patch: Partial<Pick<TouchInput, "player" | "grade" | "zone">>): ScoutData {
  const events: ScoutEvent[] = data.events.map((event) => {
    if (event.type !== "touch" || event.id !== id) return event;
    const grade =
      patch.grade && SCOUT_GRADES.includes(patch.grade) && endsRally(event.skill, patch.grade) === endsRally(event.skill, event.grade)
        ? patch.grade
        : event.grade;
    const next = sanitizeTouch(data, {
      side: event.side,
      skill: event.skill,
      player: patch.player === undefined ? event.player : patch.player,
      grade,
      zone: patch.zone === undefined ? event.zone : patch.zone,
    });
    return { ...event, ...next };
  });
  return { ...data, events };
}

/** Toglie un solo tocco. */
export function removeTouch(data: ScoutData, id: string): ScoutData {
  if (!data.events.some((e) => e.type === "touch" && e.id === id)) return data;
  return { ...data, events: data.events.filter((e) => e.id !== id), finished: false };
}

/** Aggiunge un tocco prima dell'evento `before` (per dire a posteriori chi ha ricevuto in uno scambio già chiuso). */
export function insertTouch(data: ScoutData, before: string, input: TouchInput, at: number, id: string): ScoutData {
  const index = data.events.findIndex((e) => e.id === before);
  if (index === -1 || !SCOUT_TOUCH_SKILLS.includes(input.skill) || !SCOUT_GRADES.includes(input.grade)) return data;
  const event: ScoutTouchEvent = { type: "touch", id, at, ...sanitizeTouch(data, input) };
  return { ...data, events: [...data.events.slice(0, index), event, ...data.events.slice(index)] };
}

/** Toglie uno scambio per intero: l'esito scelto a mano e tutti i tocchi che lo compongono. */
export function removeRally(data: ScoutData, id: string): ScoutData {
  const rally = deriveScout(data).rallies.find((r) => r.id === id);
  if (!rally) return data;
  const gone = new Set(rally.eventIds);
  return { ...data, events: data.events.filter((e) => !gone.has(e.id)), finished: false };
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

// ── formazione e cambi ──────────────────────────────────────────────────

export interface LineupInput {
  /** Chi è in posizione 1…6 (id della rosa, null = nessuna). */
  positions: (string | null)[];
  libero: string | null;
  hosts: [string | null, string | null];
}

/** Tiene solo giocatrici della rosa, ognuna una volta sola; la libero non sta tra le sei e le sostituite sono tra le sei. */
function sanitizeLineup(data: ScoutData, side: ScoutSide, input: LineupInput): Pick<ScoutLineupEvent, "positions" | "libero" | "hosts"> {
  const taken = new Set<string>();
  const pick = (id: string | null | undefined): string | null => {
    const found = findPlayer(data.roster, side, id ?? null)?.id ?? null;
    if (!found || taken.has(found)) return null;
    taken.add(found);
    return found;
  };
  const positions = Array.from({ length: 6 }, (_, i) => pick(input.positions[i]));
  const libero = pick(input.libero);
  const onCourt = new Set(positions.filter((id): id is string => id !== null));
  const hostSeen = new Set<string>();
  const host = (id: string | null): string | null => {
    if (!id || !onCourt.has(id) || hostSeen.has(id)) return null;
    hostSeen.add(id);
    return id;
  };
  return { positions, libero, hosts: [host(input.hosts[0]), host(input.hosts[1])] };
}

/**
 * Scrive la formazione di una squadra. Se subito prima (senza altri scambi, tocchi o cambi in mezzo) c'era già
 * una formazione della stessa squadra, la sostituisce: così correggerla più volte non riempie il registro.
 */
export function setLineup(data: ScoutData, side: ScoutSide, input: LineupInput, at: number, id: string): ScoutData {
  if (isLocked(data)) return data;
  const event: ScoutLineupEvent = { type: "lineup", id, at, side, ...sanitizeLineup(data, side, input) };
  const events = [...data.events];
  for (let i = events.length - 1; i >= 0; i--) {
    const previous = events[i];
    if (previous.type !== "lineup") break;
    if (previous.side === side) {
      events.splice(i, 1);
      break;
    }
  }
  return { ...data, events: [...events, event] };
}

/** Un cambio: `player` entra al posto di chi sta in quella posizione (serve la formazione di quella squadra). */
export function substitute(
  data: ScoutData,
  side: ScoutSide,
  position: ScoutSubEvent["position"],
  player: string,
  at: number,
  id: string,
): ScoutData {
  if (isLocked(data)) return data;
  if (!findPlayer(data.roster, side, player)) return data;
  const court = deriveScout(data).court[side];
  if (!court) return data;
  // Chi entra non può essere già in campo né essere la libero (la libero entra e esce da sola).
  if (court.positions.includes(player) || court.libero === player) return data;
  if (!court.positions[position - 1]) return data;
  return { ...data, events: [...data.events, { type: "sub", id, at, side, position, player }] };
}

/**
 * Un time-out di una squadra nel set in corso: ognuna ne ha due per set (regola 15.4). Il terzo non si aggiunge;
 * per toglierne uno si usa «Annulla ultimo» o il Registro. Non cambia punteggi né formazioni.
 */
export function addTimeout(data: ScoutData, side: ScoutSide, at: number, id: string): ScoutData {
  if (isLocked(data)) return data;
  const current = deriveScout(data).current;
  if (!current || current.timeouts.filter((t) => t.side === side).length >= TIMEOUTS_PER_SET) return data;
  return { ...data, events: [...data.events, { type: "timeout", id, at, side }] };
}

/**
 * Un numero di rotazioni da correggere ridotto a quello che si può salvare: da −5 a 5, e 0 se è un giro intero (o non è un
 * numero). Oltre i sei passi si tiene il resto, con il suo segno: 7 diventa 1, −7 diventa −1.
 */
export function foldRotationSteps(steps: number): number {
  if (!Number.isFinite(steps)) return 0;
  return Math.trunc(steps) % 6 || 0;
}

/**
 * Corregge la rotazione di una squadra (di cui si segue la formazione) di `steps` posizioni, avanti se positivo e indietro
 * se negativo, senza toccare punteggio, battuta, cambi né time-out (vedi ScoutRotateEvent). Se subito prima c'era già una
 * correzione della stessa squadra le somma: toccare più volte non riempie il registro, e a somma zero spariscono.
 */
export function rotateTeam(data: ScoutData, side: ScoutSide, steps: number, at: number, id: string): ScoutData {
  if (isLocked(data)) return data;
  if (!deriveScout(data).court[side]) return data;
  const folded = foldRotationSteps(steps);
  if (folded === 0) return data;
  const events = [...data.events];
  for (let i = events.length - 1; i >= 0; i--) {
    const previous = events[i];
    if (previous.type !== "rotate") break;
    if (previous.side === side) {
      const total = foldRotationSteps(previous.steps + folded);
      events.splice(i, 1);
      return { ...data, events: total === 0 ? events : [...events, { type: "rotate", id, at, side, steps: total }] };
    }
  }
  return { ...data, events: [...events, { type: "rotate", id, at, side, steps: folded }] };
}

/**
 * La libero esce (`out`: rientra di persona chi stava sostituendo) o rientra, per scelta dell'allenatore (vedi
 * ScoutLiberoEvent). Serve la formazione di quella squadra con una libero, e che cambi qualcosa. Se subito prima c'era il
 * contrario per la stessa squadra (toccato per sbaglio), i due si annullano: il registro resta pulito.
 */
export function setLiberoOut(data: ScoutData, side: ScoutSide, out: boolean, at: number, id: string): ScoutData {
  if (isLocked(data)) return data;
  const court = deriveScout(data).court[side];
  if (!court?.libero || court.liberoOut === out) return data;
  const last = data.events[data.events.length - 1];
  if (last?.type === "libero" && last.side === side) return { ...data, events: data.events.slice(0, -1) };
  return { ...data, events: [...data.events, { type: "libero", id, at, side, out }] };
}

// ── rosa ────────────────────────────────────────────────────────────────

/** La lunghezza massima del nome di una giocatrice a referto (come nel salvataggio, vedi schema.ts). */
const MAX_PLAYER_NAME = 60;

export function addPlayer(data: ScoutData, side: ScoutSide, player: ScoutPlayer): ScoutData {
  if (data.roster[side].some((p) => p.id === player.id)) return data;
  // Un nome troppo lungo si accorcia: non deve far rifiutare il salvataggio di tutta la partita.
  const named = player.name.length > MAX_PLAYER_NAME ? { ...player, name: player.name.slice(0, MAX_PLAYER_NAME) } : player;
  return { ...data, roster: { ...data.roster, [side]: [...data.roster[side], named] } };
}

export function updatePlayer(
  data: ScoutData,
  side: ScoutSide,
  id: string,
  patch: Partial<Pick<ScoutPlayer, "name" | "number" | "libero">>,
): ScoutData {
  const safe = patch.name !== undefined && patch.name.length > MAX_PLAYER_NAME ? { ...patch, name: patch.name.slice(0, MAX_PLAYER_NAME) } : patch;
  return {
    ...data,
    roster: { ...data.roster, [side]: data.roster[side].map((p) => (p.id === id ? { ...p, ...safe } : p)) },
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
  | { type: "touch"; input: TouchInput; at: number; id: string }
  | { type: "updateTouch"; id: string; patch: Partial<Pick<TouchInput, "player" | "grade" | "zone">> }
  | { type: "removeTouch"; id: string }
  | { type: "insertTouch"; before: string; input: TouchInput; at: number; id: string }
  | { type: "removeRally"; id: string }
  | { type: "lineup"; side: ScoutSide; input: LineupInput; at: number; id: string }
  | { type: "sub"; side: ScoutSide; position: ScoutSubEvent["position"]; player: string; at: number; id: string }
  | { type: "timeout"; side: ScoutSide; at: number; id: string }
  | { type: "rotate"; side: ScoutSide; steps: number; at: number; id: string }
  | { type: "libero"; side: ScoutSide; out: boolean; at: number; id: string }
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
    case "touch":
      return addTouch(data, action.input, action.at, action.id);
    case "updateTouch":
      return updateTouch(data, action.id, action.patch);
    case "removeTouch":
      return removeTouch(data, action.id);
    case "insertTouch":
      return insertTouch(data, action.before, action.input, action.at, action.id);
    case "removeRally":
      return removeRally(data, action.id);
    case "lineup":
      return setLineup(data, action.side, action.input, action.at, action.id);
    case "sub":
      return substitute(data, action.side, action.position, action.player, action.at, action.id);
    case "timeout":
      return addTimeout(data, action.side, action.at, action.id);
    case "rotate":
      return rotateTeam(data, action.side, action.steps, action.at, action.id);
    case "libero":
      return setLiberoOut(data, action.side, action.out, action.at, action.id);
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
