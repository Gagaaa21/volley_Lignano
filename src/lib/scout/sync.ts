import { scoutDataSchema } from "./schema";
import type { MatchScout, ScoutData } from "./types";

/**
 * Salvataggio dello scout durante la partita. Chi segna i punti è a bordo
 * campo, con la rete che va e viene: ogni modifica si salva sul server e,
 * intanto, su una copia nel telefono. Qui le regole pure (nessun browser, nessun
 * database) per decidere da quale versione partire e se due versioni coincidono.
 */

/** Il contenuto che conta di uno scout, senza i dati di salvataggio (versione, autore, data). */
export function scoutContent(data: ScoutData): ScoutData {
  return {
    // Uno scout salvato prima del punteggio live non ha `publicLive`: vale «spento».
    settings: { ...data.settings, publicLive: data.settings.publicLive ?? false },
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

export type StartDecision =
  /** Si parte da quello salvato sul server. */
  | "server"
  /** Non c'è nulla da nessuna parte: si parte da zero. */
  | "new"
  /** Si parte da quello del telefono, che ha modifiche non salvate e basate sulla versione attuale. */
  | "local"
  /** Il telefono ha modifiche non salvate, ma nel frattempo il server è cambiato: deve scegliere lo staff. */
  | "conflict";

/**
 * All'apertura della pagina: il server ha la sua versione, il telefono forse
 * una copia con modifiche rimaste a metà (rete caduta, scheda chiusa). Solo
 * una copia con modifiche non salvate conta; se coincide con il server non
 * c'è niente da scegliere.
 */
export function decideStart(
  server: Pick<MatchScout, "version" | "settings" | "roster" | "events" | "finished"> | null,
  local: LocalBackup | null,
): StartDecision {
  if (!local || !local.dirty) return server ? "server" : "new";
  if (!server) return "local";
  if (sameScout(server, local.data)) return "server";
  return server.version === local.baseVersion ? "local" : "conflict";
}
