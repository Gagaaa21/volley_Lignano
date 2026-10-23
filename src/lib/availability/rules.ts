import type { Athlete, Match } from "@/lib/types";
import {
  ABSENCE_REASONS,
  ABSENCE_REASON_LABELS,
  ANSWER_LABELS,
  ANSWER_STATUSES,
  MAX_NOTE_LENGTH,
  type AbsenceReason,
  type AnswerStatus,
  type MatchAvailability,
} from "./types";

/**
 * Le regole della presenza alle partite, in funzioni pure (con le loro prove): quali partite vede il genitore, fino a quando può
 * rispondere, come si scrivono motivo e nota, come si contano e si leggono le risposte.
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
export function parseReason(raw: unknown): AbsenceReason | null {
  return typeof raw === "string" && (ABSENCE_REASONS as readonly string[]).includes(raw) ? (raw as AbsenceReason) : null;
}

/** La risposta se è una di quelle previste, altrimenti nessuna. */
export function parseStatus(raw: unknown): AnswerStatus | null {
  return typeof raw === "string" && (ANSWER_STATUSES as readonly string[]).includes(raw) ? (raw as AnswerStatus) : null;
}

/** Cosa si scrive davvero: motivo e nota solo per un'assenza (chi ci sarà non ha niente da spiegare). */
export function normalizeAnswer(input: { status: AnswerStatus; reason?: unknown; note?: unknown }): {
  status: AnswerStatus;
  reason: AbsenceReason | null;
  note: string | null;
} {
  if (input.status === "present") return { status: "present", reason: null, note: null };
  return { status: "absent", reason: parseReason(input.reason), note: normalizeNote(input.note) };
}

/** Il giorno della partita, «AAAA-MM-GG» (la data è scritta nell'ora italiana, senza fuso). */
const matchDay = (match: Pick<Match, "matchDate">) => match.matchDate.slice(0, 10);

/**
 * Il genitore può rispondere e cambiare fino all'inizio della partita: anche la mattina stessa, se la figlia sta male. `now` è
 * data e ora di adesso scritte come quelle della partita («AAAA-MM-GGTHH:mm», ora italiana). Lo staff non ha limiti.
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
  /** Il genitore può ancora rispondere (fino all'inizio della partita). */
  open: boolean;
}

/**
 * Le partite su cui il genitore può rispondere: della squadra e della categoria dell'atleta, da oggi in poi e non ancora giocate,
 * dalla più vicina. Quelle già cominciate si vedono ma sono chiuse.
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
 * Il genitore risponde e cambia la risposta (anche una scritta dall'allenatore: l'ultima vale, e si vede chi l'ha scritta)
 * finché la partita non comincia; dopo, non da qui.
 */
export function canParentChange(match: Pick<Match, "matchDate">, now: string): ParentChange {
  if (!isReportingOpen(match, now)) {
    return { ok: false, error: "La partita è già cominciata: da qui non si può più cambiare." };
  }
  return { ok: true };
}

/** La risposta in una riga, per lo staff: «Ci sarà» oppure «Non ci sarà · Malata o infortunata · mal di gola». */
export function describeAnswer(row: Pick<MatchAvailability, "status" | "reason" | "note">): string {
  if (row.status === "present") return ANSWER_LABELS.present;
  return [ANSWER_LABELS.absent, row.reason ? ABSENCE_REASON_LABELS[row.reason] : null, row.note].filter(Boolean).join(" · ");
}

export interface AnswerCounts {
  present: number;
  absent: number;
  /** Chi non ha ancora risposto. */
  none: number;
}

/** Quante atlete ci sono, quante no e quante non hanno risposto, tra quelle indicate (le risposte di altre non contano). */
export function countAnswers(
  athleteIds: readonly string[],
  rows: readonly Pick<MatchAvailability, "athleteId" | "status">[],
): AnswerCounts {
  const statusOf = new Map(rows.map((row) => [row.athleteId, row.status] as const));
  const counts: AnswerCounts = { present: 0, absent: 0, none: 0 };
  for (const athleteId of new Set(athleteIds)) {
    const status = statusOf.get(athleteId);
    if (status === "present") counts.present += 1;
    else if (status === "absent") counts.absent += 1;
    else counts.none += 1;
  }
  return counts;
}

/** Quante atlete hanno risposto «Non ci sarà», partita per partita (per elenco partite e dashboard). */
export function absentByMatch(rows: readonly Pick<MatchAvailability, "matchId" | "status">[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.status === "absent") counts.set(row.matchId, (counts.get(row.matchId) ?? 0) + 1);
  }
  return counts;
}

/** «1 non c'è» / «3 non ci sono»: il conteggio delle assenti per l'elenco partite e la dashboard. */
export function absentLabel(count: number): string {
  return count === 1 ? "1 non c'è" : `${count} non ci sono`;
}

/** L'ordine in cui lo staff le legge: prima chi non c'è, poi chi non ha risposto, poi chi c'è. */
export function answerOrder(status: AnswerStatus | null): number {
  return status === "absent" ? 0 : status === null ? 1 : 2;
}
