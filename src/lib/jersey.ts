/**
 * Il numero di maglia di un'atleta, scritto una volta sola nell'anagrafica e
 * ripescato da Scout e Live score. Qui le regole pure: cosa è un numero valido,
 * come lo si legge da una riga incollata in elenco, quando due atlete lo
 * condividono e come riconoscere la colonna ancora da creare su Supabase.
 */

import type { Category } from "@/lib/types";

/** Il numero più alto che si scrive sulla maglia (a referto sono due cifre). */
export const JERSEY_NUMBER_MAX = 99;

/**
 * Da quello che si scrive in un campo al numero da salvare.
 * `""` → `null` (nessun numero), `"7"` o `"07"` → 7, tutto il resto
 * (lettere, negativi, oltre 99, decimali) → `undefined` = non valido.
 */
export function parseJerseyNumber(raw: string | null | undefined): number | null | undefined {
  const text = (raw ?? "").trim();
  if (text === "") return null;
  if (!/^\d{1,2}$/.test(text)) return undefined;
  const value = Number(text);
  return value <= JERSEY_NUMBER_MAX ? value : undefined;
}

/** Numero di maglia come testo (così com'è a referto e in Scout), vuoto se manca. */
export function jerseyText(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

export interface ParsedAthleteLine {
  fullName: string;
  jerseyNumber: number | null;
}

const SEPARATORS = String.raw`[\s.,;:)\-–—/|]`;
/** Davanti: «7 Giulia», «7. Giulia», «07 - Giulia», «#7 Giulia», «N° 7 Giulia». */
const LEADING = new RegExp(String.raw`^(?:#\s*|n\s*[°º.]?\s*)?(\d{1,2})${SEPARATORS}+(.*\S)\s*$`, "i");
/** In fondo: «Giulia 7», «Giulia - 7», «Giulia, 7», «Giulia (7)», «Giulia n° 7», «Giulia #7». */
const TRAILING = new RegExp(String.raw`^(.*?[^\s.,;:)\-–—/|])${SEPARATORS}+(?:#\s*|n\s*[°º.]?\s*)?[(\[]?(\d{1,2})[)\]]?\s*$`, "i");

/**
 * Una riga dell'elenco incollato per aggiungere le atlete: il nome, con
 * facoltativamente il numero di maglia prima o dopo («7 Giulia Bianchi»,
 * «Giulia Bianchi 7», «Giulia Bianchi (7)», anche da un foglio di calcolo con le
 * celle separate da tabulazioni). Un numero a tre o più cifre (un anno, per
 * esempio) non è un numero di maglia e resta nel nome.
 */
export function parseAthleteBulkLine(line: string): ParsedAthleteLine {
  const text = line.replace(/\t+/g, " ").replace(/\s+/g, " ").trim();
  const leading = LEADING.exec(text);
  if (leading) return { fullName: leading[2].trim(), jerseyNumber: Number(leading[1]) };
  const trailing = TRAILING.exec(text);
  if (trailing) return { fullName: trailing[1].trim(), jerseyNumber: Number(trailing[2]) };
  return { fullName: text, jerseyNumber: null };
}

/** Per confrontare due nomi scritti in momenti diversi: senza maiuscole né spazi doppi. */
export function nameKey(name: string): string {
  return name.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Atlete che condividono lo stesso numero (con il numero come chiave). */
export function sharedJerseyNumbers<T extends { jerseyNumber: number | null }>(athletes: T[]): Map<number, T[]> {
  const byNumber = new Map<number, T[]>();
  for (const athlete of athletes) {
    if (athlete.jerseyNumber === null || athlete.jerseyNumber === undefined) continue;
    byNumber.set(athlete.jerseyNumber, [...(byNumber.get(athlete.jerseyNumber) ?? []), athlete]);
  }
  for (const [number, group] of byNumber) if (group.length < 2) byNumber.delete(number);
  return byNumber;
}

/**
 * La colonna `jersey_number` si crea su Supabase a mano, mentre il sito si
 * aggiorna da solo a ogni pubblicazione: finché manca, salvare un'atleta non
 * deve rompersi, si salva senza numero. Riconosce l'errore «colonna inesistente»
 * di Postgres e di PostgREST.
 */
export function isJerseyColumnMissing(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return /jersey_number/i.test(message) && /(does not exist|could not find|schema cache|42703|PGRST204)/i.test(message);
}

/** Un numero dell'anagrafica da proporre nel Live score in Partita. */
export interface RegistryNumber {
  id: string;
  /** Il numero come testo, così come si scrive nelle formazioni. */
  number: string;
  name: string;
  category: Category | null;
}

/** I numeri da proporre, divisi tra le convocate della partita collegata e le altre. */
export interface RegistryChoices {
  calledUp: RegistryNumber[];
  others: RegistryNumber[];
}

/**
 * In che ordine proporre i numeri dell'anagrafica nel Live score in Partita:
 * prima le convocate della partita collegata (se c'è), poi le altre, con la
 * stessa categoria della partita davanti; a parità, per numero.
 */
export function orderRegistryNumbers(list: RegistryNumber[], calledUpIds: string[], category: Category | null): RegistryChoices {
  const called = new Set(calledUpIds);
  const byNumber = (a: RegistryNumber, b: RegistryNumber) => Number(a.number) - Number(b.number) || a.name.localeCompare(b.name, "it");
  const sameCategoryFirst = (a: RegistryNumber, b: RegistryNumber) =>
    Number(category !== null && b.category === category) - Number(category !== null && a.category === category) || byNumber(a, b);
  return {
    calledUp: list.filter((r) => called.has(r.id)).sort(byNumber),
    others: list.filter((r) => !called.has(r.id)).sort(sameCategoryFirst),
  };
}
