import type { Athlete, Match } from "@/lib/types";
import {
  MAX_NOTE_LENGTH,
  UNAVAILABILITY_REASONS,
  UNAVAILABILITY_REASON_LABELS,
  type MatchUnavailability,
  type UnavailabilityReason,
} from "./types";

/**
 * Le regole della disponibilità, in funzioni pure (con le loro prove): quali partite vede il genitore, fino a quando può
 * cambiare, cosa può toccare e cosa no, come si scrivono motivo e nota.
 */

/** La nota facoltativa, ripulita: spazi in più e caratteri di controllo tolti, al massimo 120 caratteri. Vuota = nessuna nota. */
export function normalizeNote(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw
    // I caratteri di controllo (a capo compresi) si tolgono di proposito.
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NOTE_LENGTH)
    .trim();
  return text || null;
}

/** Il motivo se è uno di quelli previsti, altrimenti nessuno (non si accetta testo libero al suo posto). */
export function parseReason(raw: unknown): UnavailabilityReason | null {
  return typeof raw === "string" && (UNAVAILABILITY_REASONS as readonly string[]).includes(raw) ? (raw as UnavailabilityReason) : null;
}

/** Il giorno della partita, «AAAA-MM-GG» (la data è scritta nell'ora italiana, senza fuso). */
const matchDay = (match: Pick<Match, "matchDate">) => match.matchDate.slice(0, 10);

/**
 * Il genitore può cambiare fino all'inizio della partita: anche la mattina stessa, se la figlia sta male. `now` è data e ora di
 * adesso scritte come quelle della partita («AAAA-MM-GGTHH:mm», ora italiana). Lo staff non ha limiti.
 */
export function isReportingOpen(match: Pick<Match, "matchDate">, now: string): boolean {
  return now < match.matchDate.slice(0, 16);
}

/** Il link di un'atleta funziona solo finché è in squadra attiva e solo per U14/U15 (il Minivolley non ha partite né link). */
export function canUseFamilyLink(athlete: Pick<Athlete, "team" | "isActive">): boolean {
  return athlete.team === "u14u15" && athlete.isActive;
}

/** Una partita riguarda l'atleta se è della sua squadra e della sua categoria (o se uno dei due non ha categoria). */
export function appliesToAthlete(match: Pick<Match, "team" | "category">, athlete: Pick<Athlete, "team" | "category">): boolean {
  if (match.team !== athlete.team) return false;
  return match.category === null || athlete.category === null || match.category === athlete.category;
}

export interface AvailabilityMatch {
  match: Match;
  /** Il genitore può ancora cambiare (fino all'inizio della partita). */
  open: boolean;
}

/**
 * Le partite su cui il genitore può dire qualcosa: della squadra e della categoria dell'atleta, da oggi in poi e non ancora
 * giocate, dalla più vicina. Quelle già cominciate si vedono ma sono chiuse.
 */
export function matchesForAthlete(
  athlete: Pick<Athlete, "team" | "category">,
  matches: readonly Match[],
  now: string,
  limit = 12,
): AvailabilityMatch[] {
  const today = now.slice(0, 10);
  return matches
    .filter((match) => appliesToAthlete(match, athlete))
    .filter((match) => matchDay(match) >= today)
    .filter((match) => match.setScores === null && match.resultSetsWon === null)
    .sort((a, b) => a.matchDate.localeCompare(b.matchDate))
    .slice(0, limit)
    .map((match) => ({ match, open: isReportingOpen(match, now) }));
}

export type ParentChange = { ok: true } | { ok: false; error: string };

/**
 * Il genitore cambia la segnalazione (anche una scritta dallo staff: l'ultima modifica vale, e si vede chi l'ha fatta) finché la
 * partita non comincia; dopo, non da qui.
 */
export function canParentChange(match: Pick<Match, "matchDate">, now: string): ParentChange {
  if (!isReportingOpen(match, now)) {
    return { ok: false, error: "La partita è già cominciata: da qui non si può più cambiare." };
  }
  return { ok: true };
}

/** Motivo e nota in una riga, per lo staff: «Malata o infortunata · mal di gola». */
export function describeUnavailability(row: Pick<MatchUnavailability, "reason" | "note">): string {
  return [row.reason ? UNAVAILABILITY_REASON_LABELS[row.reason] : null, row.note].filter(Boolean).join(" · ") || "Nessun motivo indicato";
}

/** Quante atlete sono segnalate non disponibili, partita per partita. */
export function countByMatch(rows: readonly Pick<MatchUnavailability, "matchId">[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.matchId, (counts.get(row.matchId) ?? 0) + 1);
  return counts;
}
