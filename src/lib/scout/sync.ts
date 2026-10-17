import { normalizeSettings } from "./actions";
import { scoutDataSchema } from "./schema";
import type { MatchScout, ScoutData, ScoutEvent, ScoutPlayer, ScoutRoster } from "./types";

/**
 * Salvataggio dello scout durante la partita. Chi segna i punti è a bordo
 * campo, con la rete che va e viene: ogni modifica si salva sul server e,
 * intanto, su una copia nel telefono. Qui le regole pure (nessun browser, nessun
 * database) per decidere da quale versione partire e se due versioni coincidono.
 */

/** Il contenuto che conta di uno scout, senza i dati di salvataggio (versione, autore, data). */
export function scoutContent(data: ScoutData): ScoutData {
  return {
    // Uno scout salvato prima del punteggio live o dei livelli non ha `publicLive` né `level`: valgono «spento» e «base».
    settings: normalizeSettings(data.settings),
    roster: data.roster,
    events: data.events,
    finished: data.finished,
  };
}

/** JSON con le chiavi in ordine: il database può riordinarle, il contenuto no. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
    }
    return v;
  });
}

export function sameScout(a: ScoutData, b: ScoutData): boolean {
  return canonicalJson(scoutContent(a)) === canonicalJson(scoutContent(b));
}

/** La copia tenuta nel telefono: `dirty` = ci sono modifiche non ancora arrivate al server. */
export interface LocalBackup {
  data: ScoutData;
  /** Versione del server su cui si basavano le modifiche (null = ancora mai salvato). */
  baseVersion: number | null;
  dirty: boolean;
  savedAt: number;
}

export function backupKey(matchId: string): string {
  return `volley-scout-${matchId}`;
}

/** Legge la copia salvata: qualunque cosa non torni (formato vecchio, JSON rotto) vale «nessuna copia». */
export function parseBackup(raw: string | null): LocalBackup | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LocalBackup> | null;
    if (!parsed || typeof parsed !== "object") return null;
    const data = scoutDataSchema.safeParse(parsed.data);
    if (!data.success) return null;
    const baseVersion =
      typeof parsed.baseVersion === "number" && Number.isInteger(parsed.baseVersion) && parsed.baseVersion >= 1
        ? parsed.baseVersion
        : null;
    return {
      data: data.data,
      baseVersion,
      dirty: parsed.dirty === true,
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : 0,
    };
  } catch {
    return null;
  }
}

// ── unire due versioni ───────────────────────────────────────────────────

/** Quanti scambi, tocchi, cambi… due elenchi di eventi hanno in comune dall'inizio (stesso evento, con lo stesso contenuto). */
export function prefixLength(a: readonly ScoutEvent[], b: readonly ScoutEvent[]): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i].id === b[i].id && canonicalJson(a[i]) === canonicalJson(b[i])) i++;
  return i;
}

/** La rosa di `primary` con in più chi c'è solo in `secondary`: unendo due versioni non si perde nessuna giocatrice. */
export function mergeRoster(primary: ScoutRoster, secondary: ScoutRoster): ScoutRoster {
  const union = (first: ScoutPlayer[], second: ScoutPlayer[]) => {
    const known = new Set(first.map((p) => p.id));
    return [...first, ...second.filter((p) => !known.has(p.id))];
  };
  return { us: union(primary.us, secondary.us), opp: union(primary.opp, secondary.opp) };
}

/**
 * Come stanno due versioni dello stesso scout, quella sul server e quella di questo dispositivo:
 * - same: hanno gli stessi scambi (cambia al più la rosa o le regole): si tiene questo dispositivo;
 * - mine: questo dispositivo ha in più qualcosa, cioè il salvataggio era arrivato ma la risposta si è persa: si tiene e si salva;
 * - server: il server ha in più qualcosa (questo dispositivo era rimasto indietro): non c'è niente di suo da perdere;
 * - merged: hanno cose diverse ma di momenti diversi (per esempio due dispositivi che hanno segnato uno dopo l'altro): si uniscono;
 * - conflict: hanno cose diverse negli stessi momenti (due persone che segnano insieme): deve scegliere lo staff.
 * La rosa si unisce sempre: non si perde nessuna giocatrice.
 */
export type Reconciliation =
  | { kind: "same"; data: ScoutData }
  | { kind: "mine"; data: ScoutData }
  | { kind: "server"; data: ScoutData }
  | { kind: "merged"; data: ScoutData }
  | { kind: "conflict" };

function firstAt(events: readonly ScoutEvent[]): number {
  return events.reduce((min, event) => Math.min(min, event.at), Number.POSITIVE_INFINITY);
}

function lastAt(events: readonly ScoutEvent[]): number {
  return events.reduce((max, event) => Math.max(max, event.at), Number.NEGATIVE_INFINITY);
}

export function reconcile(serverData: ScoutData, mineData: ScoutData): Reconciliation {
  const server = scoutContent(serverData);
  const mine = scoutContent(mineData);
  const common = prefixLength(server.events, mine.events);
  const onlyServer = server.events.slice(common);
  const onlyMine = mine.events.slice(common);

  if (onlyServer.length === 0 && onlyMine.length === 0) {
    return { kind: "same", data: { ...mine, roster: mergeRoster(mine.roster, server.roster) } };
  }
  if (onlyServer.length === 0) return { kind: "mine", data: { ...mine, roster: mergeRoster(mine.roster, server.roster) } };
  if (onlyMine.length === 0) return { kind: "server", data: { ...server, roster: mergeRoster(server.roster, mine.roster) } };

  // Tutti e due hanno cose che l'altro non ha: si possono unire solo se sono di momenti diversi (nessuna sovrapposizione)
  // e se non c'è uno stesso scambio scritto in due modi (uno corretto da una parte sola): quello lo deve scegliere lo staff.
  const serverIds = new Set(onlyServer.map((event) => event.id));
  if (onlyMine.some((event) => serverIds.has(event.id))) return { kind: "conflict" };
  const serverFirst = lastAt(onlyServer) < firstAt(onlyMine);
  const mineFirst = lastAt(onlyMine) < firstAt(onlyServer);
  if (!serverFirst && !mineFirst) return { kind: "conflict" };
  const [earlier, later] = serverFirst ? [onlyServer, onlyMine] : [onlyMine, onlyServer];
  const events = [...server.events.slice(0, common), ...earlier, ...later];
  // Un'unione con scambi doppi non sarebbe uno scout valido (il salvataggio la rifiuterebbe): meglio chiedere.
  if (new Set(events.map((event) => event.id)).size !== events.length) return { kind: "conflict" };
  return {
    kind: "merged",
    data: {
      settings: mine.settings,
      roster: mergeRoster(mine.roster, server.roster),
      events,
      // Una partita data per chiusa a mano su una sola delle due versioni resta aperta: si può sempre richiudere.
      finished: mine.finished && server.finished,
    },
  };
}

export type StartPlan =
  /** Si parte da quello salvato sul server. */
  | { kind: "server" }
  /** Non c'è nulla da nessuna parte: si parte da zero. */
  | { kind: "new" }
  /** Si parte da `data` (la copia del telefono, eventualmente unita al server) e lo si salva. */
  | { kind: "local"; data: ScoutData; /** Il server e il telefono avevano cose diverse e sono stati uniti. */ merged: boolean }
  /** Il telefono e il server hanno cose diverse negli stessi momenti: deve scegliere lo staff. */
  | { kind: "conflict" };

/**
 * All'apertura della pagina: il server ha la sua versione, il telefono forse una copia con modifiche rimaste a metà
 * (rete caduta, scheda chiusa). Solo una copia con modifiche non salvate conta; se coincide con il server non c'è
 * niente da scegliere. Se il server è cambiato nel frattempo si guarda cosa è cambiato: se uno dei due ha solo cose
 * in più dell'altro (il caso di un salvataggio arrivato ma senza risposta) o se hanno cose di momenti diversi, si tiene
 * tutto e non si chiede niente; si chiede solo quando due persone hanno segnato insieme cose diverse.
 */
export function planStart(
  server: Pick<MatchScout, "version" | "settings" | "roster" | "events" | "finished"> | null,
  local: LocalBackup | null,
): StartPlan {
  if (!local || !local.dirty) return server ? { kind: "server" } : { kind: "new" };
  if (!server) return { kind: "local", data: local.data, merged: false };
  if (sameScout(server, local.data)) return { kind: "server" };
  // Le modifiche del telefono partono proprio dalla versione attuale del server: sono le più recenti.
  if (server.version === local.baseVersion) return { kind: "local", data: local.data, merged: false };
  const verdict = reconcile(scoutContent(server), local.data);
  if (verdict.kind === "conflict") return { kind: "conflict" };
  if (sameScout(server, verdict.data)) return { kind: "server" };
  return { kind: "local", data: verdict.data, merged: verdict.kind === "merged" };
}
