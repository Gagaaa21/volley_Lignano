import { scoutDataSchema } from "./schema";
import { canonicalJson, scoutContent } from "./sync";
import type { ScoutData } from "./types";

/**
 * Le copie di recupero dello scout, tenute nel dispositivo di chi segna: ogni volta che una versione sta per essere
 * sostituita o scartata (conflitto, azzeramento, unione, ripristino) e ogni volta che si chiude un set, se ne mette da parte
 * una copia. Così un salvataggio andato storto non fa mai perdere un set: si può sempre tornare a una copia. Qui le regole
 * pure (nessun browser, nessun database); la pagina le legge e le scrive nel telefono (useScoutSession).
 */

/** Perché si è messa da parte una copia. */
export type ArchiveReason =
  /** Si è chiuso un set. */
  | "set"
  /** Si è scelta una versione e l'altra è stata scartata. */
  | "conflitto"
  /** Prima di azzerare lo scout. */
  | "azzeramento"
  /** Prima di unire due versioni. */
  | "unione"
  /** Prima di sostituire lo scout con una copia. */
  | "ripristino";

export const ARCHIVE_REASON_LABELS: Record<ArchiveReason, string> = {
  set: "Set chiuso",
  conflitto: "Versione scartata",
  azzeramento: "Prima di azzerare",
  unione: "Prima di unire due versioni",
  ripristino: "Prima di ripristinare",
};

export interface ArchiveEntry {
  id: string;
  /** Istante in cui è stata messa da parte (ms). */
  at: number;
  reason: ArchiveReason;
  data: ScoutData;
}

/** Quante copie si tengono per partita: bastano i 5 set più qualche versione scartata. */
export const MAX_ARCHIVE = 8;

/** Dopo quanto tempo le copie di una partita vecchia si buttano via per liberare spazio (giorni). */
export const ARCHIVE_KEEP_DAYS = 90;

export function archiveKey(matchId: string): string {
  return `volley-scout-archive-${matchId}`;
}

const REASONS = new Set<string>(Object.keys(ARCHIVE_REASON_LABELS));

/** Legge le copie salvate: quelle illeggibili o non valide si ignorano, le altre restano. Dalla più recente. */
export function parseArchive(raw: string | null): ArchiveEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const entries: ArchiveEntry[] = [];
    for (const item of parsed as Partial<ArchiveEntry>[]) {
      if (!item || typeof item !== "object") continue;
      const data = scoutDataSchema.safeParse(item.data);
      if (!data.success || typeof item.id !== "string" || !item.id || typeof item.at !== "number") continue;
      entries.push({ id: item.id, at: item.at, reason: REASONS.has(String(item.reason)) ? (item.reason as ArchiveReason) : "conflitto", data: data.data });
    }
    return entries.sort((a, b) => b.at - a.at);
  } catch {
    return [];
  }
}

/**
 * Aggiunge una copia in testa. Una copia identica a una già presente non si ripete (si aggiorna solo quando e perché); oltre
 * `max` le più vecchie si perdono.
 */
export function addToArchive(list: readonly ArchiveEntry[], entry: ArchiveEntry, max = MAX_ARCHIVE): ArchiveEntry[] {
  const content = canonicalJson(scoutContent(entry.data));
  const others = list.filter((item) => canonicalJson(scoutContent(item.data)) !== content);
  return [entry, ...others].slice(0, max);
}

/** Quante copie restano se lo spazio non basta: si butta via la più vecchia. */
export function withoutOldest(list: readonly ArchiveEntry[]): ArchiveEntry[] {
  return [...list].sort((a, b) => b.at - a.at).slice(0, -1);
}

/** Le copie di una partita sono troppo vecchie per tenerle? Serve a fare pulizia delle partite passate. */
export function isArchiveStale(list: readonly ArchiveEntry[], now: number): boolean {
  if (list.length === 0) return true;
  const newest = Math.max(...list.map((item) => item.at));
  return now - newest > ARCHIVE_KEEP_DAYS * 24 * 60 * 60 * 1000;
}
