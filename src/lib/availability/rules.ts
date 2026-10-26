import type { Athlete, Match } from "@/lib/types";
import {
  DEFAULT_REPORTING_POLICY,
  DEFAULT_REPORTING_RULES,
  autoDeadline,
  parentBlockMessage,
  reportingState,
  type MatchReporting,
  type ReportingPolicy,
  type ReportingRules,
  type ReportingState,
} from "./reporting";
import { ABSENCE_REASONS, ABSENCE_REASON_LABELS, ANSWER_LABELS, MAX_NOTE_LENGTH, type AbsenceReason, type MatchAvailability } from "./types";

/**
 * Le regole delle assenze alle partite, in funzioni pure (con le loro prove): quali partite vede il genitore, fino a quando può
 * segnalare un'assenza, come si scrivono motivo e nota, come si contano e si leggono le assenze.
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

/** Un'assenza come si scrive davvero: il motivo solo se è uno di quelli previsti, la nota ripulita. */
export function normalizeAbsence(input: { reason?: unknown; note?: unknown }): { status: "absent"; reason: AbsenceReason | null; note: string | null } {
  return { status: "absent", reason: parseReason(input.reason), note: normalizeNote(input.note) };
}

/** Solo le assenze (le righe «present» di una versione di prova non contano). */
export function isAbsence(row: Pick<MatchAvailability, "status">): boolean {
  return row.status === "absent";
}

/** Il giorno della partita, «AAAA-MM-GG» (la data è scritta nell'ora italiana, senza fuso). */
const matchDay = (match: Pick<Match, "matchDate">) => match.matchDate.slice(0, 10);

/**
 * Fino a quando il genitore può segnalare un'assenza (o toglierla) secondo le regole: di serie 5 giorni prima dell'inizio della
 * partita, alla stessa ora (partita sabato alle 18:00 → fino a lunedì alle 18:00). Data e ora si scrivono come quelle della partita,
 * «AAAA-MM-GGTHH:mm» nell'ora italiana: il conto è sui giorni del calendario, quindi il cambio dell'ora legale non sposta niente.
 * Le scelte fatte a mano per una partita sono in reporting.ts.
 */
export function reportingDeadline(match: Pick<Match, "matchDate">, rules: ReportingRules = DEFAULT_REPORTING_RULES): string {
  return autoDeadline(match, rules);
}

/** Il genitore può ancora segnalare? `now` è data e ora di adesso, scritte come quelle della partita. Lo staff non ha limiti. */
export function isReportingOpen(
  match: Pick<Match, "matchDate">,
  now: string,
  rules: ReportingRules = DEFAULT_REPORTING_RULES,
  setting: MatchReporting | null = null,
): boolean {
  return reportingState(match, now, rules, setting).kind === "open";
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
  /** Il genitore può ancora segnalare un'assenza (fino alla scadenza, se le segnalazioni non sono sospese). */
  open: boolean;
  /** Come stanno le segnalazioni, con la scadenza (vedi reporting.ts). */
  state: ReportingState;
  /** Quello che lo staff ha scelto a mano per la partita, se qualcosa. */
  setting: MatchReporting | null;
}

/**
 * Le partite che il genitore vede: della squadra e della categoria dell'atleta, da oggi in poi e non ancora giocate, dalla più
 * vicina, tranne quelle per cui lo staff ha scelto di non chiedere niente. Quelle oltre la scadenza si vedono (con l'assenza, se
 * c'è) ma sono chiuse.
 */
export function matchesForAthlete(
  athlete: Pick<Athlete, "team" | "category">,
  matches: readonly Match[],
  now: string,
  limit = 12,
  policy: ReportingPolicy = DEFAULT_REPORTING_POLICY,
): AvailabilityMatch[] {
  const today = now.slice(0, 10);
  return matches
    .filter((match) => appliesToAthlete(match, athlete))
    .filter((match) => matchDay(match) >= today)
    .filter((match) => match.setScores === null && match.resultSetsWon === null)
    .filter((match) => !policy.matches.get(match.id)?.hidden)
    .sort((a, b) => a.matchDate.localeCompare(b.matchDate))
    .slice(0, limit)
    .map((match) => {
      const setting = policy.matches.get(match.id) ?? null;
      const state = reportingState(match, now, policy.rules, setting);
      return { match, open: state.kind === "open", state, setting };
    });
}

export type ParentChange = { ok: true } | { ok: false; error: string };

/**
 * Il genitore segnala o toglie un'assenza (anche una scritta dall'allenatore: vale l'ultima) solo finché le segnalazioni di quella
 * partita sono aperte: non sospese, non chiuse a mano, prima della scadenza, e solo se per la partita si chiede ai genitori.
 */
export function canParentChange(
  match: Pick<Match, "matchDate">,
  now: string,
  rules: ReportingRules = DEFAULT_REPORTING_RULES,
  setting: MatchReporting | null = null,
): ParentChange {
  const blocked = parentBlockMessage(reportingState(match, now, rules, setting), rules);
  return blocked ? { ok: false, error: blocked } : { ok: true };
}

/** L'assenza in una riga, per lo staff: «Non ci sarà · Malata o infortunata · mal di gola». */
export function describeAbsence(row: Pick<MatchAvailability, "reason" | "note">): string {
  return [ANSWER_LABELS.absent, row.reason ? ABSENCE_REASON_LABELS[row.reason] : null, row.note].filter(Boolean).join(" · ");
}

/** Quante atlete non ci saranno, partita per partita (per elenco partite e dashboard). */
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
