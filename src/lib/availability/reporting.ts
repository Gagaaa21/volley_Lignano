import type { Match } from "@/lib/types";
import { REPORT_CLOSES_DAYS_BEFORE } from "./types";

/**
 * Fino a quando i genitori possono segnalare un'assenza dal loro link, e cosa vedono. Valgono le regole generali (quanti giorni prima
 * si chiude, a che ora, una pausa per tutte le partite, un avviso in cima alla pagina), che l'allenatore o il Developer cambiano dalla
 * pagina «Assenze alle partite»; e per una singola partita si può scegliere a mano: chiuderla adesso, riaprirla, dare un'altra
 * scadenza, non chiedere niente ai genitori o lasciare loro un messaggio. Funzioni pure, con le loro prove: le usano la pagina del
 * genitore, le sue azioni (che ricontrollano tutto) e le pagine dello staff.
 *
 * Date e ore si scrivono come quelle delle partite, «AAAA-MM-GGTHH:mm» nell'ora italiana, e si confrontano come testo.
 */

/** Dove stanno, tra le impostazioni del sito (tabella app_settings): le regole, e una chiave per ogni partita con una scelta a mano. */
export const REPORTING_RULES_KEY = "availability_rules";
export const MATCH_REPORTING_PREFIX = "availability_match:";
export const matchReportingKey = (matchId: string) => `${MATCH_REPORTING_PREFIX}${matchId}`;

/** Le regole uguali per tutte le partite. */
export interface ReportingRules {
  /** Quanti giorni prima della partita si chiudono da sole (0 = all'inizio della partita). */
  daysBefore: number;
  /** A che ora di quel giorno: null = alla stessa ora della partita. */
  closingTime: string | null;
  /** Segnalazioni sospese per tutte le partite: il genitore vede le partite ma non può segnalare. */
  paused: boolean;
  /** Un avviso per i genitori, in cima alla pagina del loro link. */
  notice: string | null;
  /** Chi le ha cambiate l'ultima volta e quando (ISO): null finché sono quelle di serie. */
  updatedAt: string | null;
  updatedBy: string | null;
}

export const MAX_DAYS_BEFORE = 14;
export const MAX_NOTICE_LENGTH = 300;
export const MAX_MATCH_MESSAGE_LENGTH = 200;

export const DEFAULT_REPORTING_RULES: ReportingRules = {
  daysBefore: REPORT_CLOSES_DAYS_BEFORE,
  closingTime: null,
  paused: false,
  notice: null,
  updatedAt: null,
  updatedBy: null,
};

/** Quello che è stato scelto a mano per una partita (se non c'è niente valgono le regole generali). */
export interface MatchReporting {
  matchId: string;
  /** La scadenza scelta a mano; null = quella delle regole. «Chiudi adesso» la mette ad adesso. Mai oltre l'inizio della partita. */
  closesAt: string | null;
  /** Per questa partita non si chiede niente ai genitori: dal link non si vede. */
  hidden: boolean;
  /** Un messaggio per i genitori su questa partita, nella pagina del link. */
  message: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

/** Le regole e le scelte partita per partita, insieme. */
export interface ReportingPolicy {
  rules: ReportingRules;
  matches: ReadonlyMap<string, MatchReporting>;
}

export const DEFAULT_REPORTING_POLICY: ReportingPolicy = { rules: DEFAULT_REPORTING_RULES, matches: new Map() };

const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

/** «AAAA-MM-GGTHH:mm» di una data vera (niente 31 febbraio). */
export function isLocalDateTime(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_TIME.test(value)) return false;
  const [date, time] = value.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const real = new Date(Date.UTC(y, m - 1, d));
  return real.getUTCFullYear() === y && real.getUTCMonth() === m - 1 && real.getUTCDate() === d && CLOCK.test(time);
}

/** «HH:mm» valido. */
export function isClockTime(value: unknown): value is string {
  return typeof value === "string" && CLOCK.test(value);
}

/** Un testo per i genitori, ripulito: una riga sola, senza caratteri di controllo, al massimo `max` caratteri. Vuoto = niente. */
export function normalizeParentText(raw: unknown, max: number): string | null {
  if (typeof raw !== "string") return null;
  const text = raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
  return text || null;
}

/** L'inizio della partita, «AAAA-MM-GGTHH:mm» (senza ora: mezzanotte). */
export function matchStart(match: Pick<Match, "matchDate">): string {
  const [date, time = "00:00"] = match.matchDate.slice(0, 16).split("T");
  return `${date}T${time.slice(0, 5)}`;
}

const earliest = (a: string, b: string) => (a < b ? a : b);

/**
 * La scadenza delle regole: tanti giorni prima della partita, alla stessa ora della partita o all'ora scelta (partita sabato alle
 * 18:00, 5 giorni prima → lunedì alle 18:00). Il conto è sui giorni del calendario, quindi il cambio dell'ora legale non sposta
 * niente; e non va mai oltre l'inizio della partita.
 */
export function autoDeadline(match: Pick<Match, "matchDate">, rules: Pick<ReportingRules, "daysBefore" | "closingTime"> = DEFAULT_REPORTING_RULES): string {
  const start = matchStart(match);
  const [date, time] = start.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const closingDay = new Date(Date.UTC(year, month - 1, day - rules.daysBefore)).toISOString().slice(0, 10);
  return earliest(`${closingDay}T${rules.closingTime ?? time}`, start);
}

/** La scadenza che vale davvero: quella scelta a mano se c'è, altrimenti quella delle regole; mai oltre l'inizio della partita. */
export function effectiveDeadline(match: Pick<Match, "matchDate">, rules: ReportingRules, setting: MatchReporting | null | undefined): string {
  return earliest(setting?.closesAt ?? autoDeadline(match, rules), matchStart(match));
}

export type ReportingState =
  /** Si può segnalare fino a `deadline`; `manual` se la scadenza è stata scelta a mano. */
  | { kind: "open"; deadline: string; manual: boolean }
  /** Chiuse da `deadline`; `manual` se le ha chiuse (o ne ha scelto la scadenza) lo staff. */
  | { kind: "closed"; deadline: string; manual: boolean }
  /** Per questa partita non si chiede niente ai genitori. */
  | { kind: "hidden" }
  /** Sospese per tutte le partite. */
  | { kind: "paused" };

/** Come stanno adesso le segnalazioni di una partita. Prima la scelta di non chiedere niente, poi la pausa, poi la scadenza. */
export function reportingState(
  match: Pick<Match, "matchDate">,
  now: string,
  rules: ReportingRules = DEFAULT_REPORTING_RULES,
  setting: MatchReporting | null | undefined = null,
): ReportingState {
  if (setting?.hidden) return { kind: "hidden" };
  if (rules.paused) return { kind: "paused" };
  const deadline = effectiveDeadline(match, rules, setting);
  const manual = Boolean(setting?.closesAt);
  return now < deadline ? { kind: "open", deadline, manual } : { kind: "closed", deadline, manual };
}

/** «5 giorni prima» / «1 giorno prima» / «all'inizio della partita». */
export function daysBeforePhrase(daysBefore: number): string {
  if (daysBefore === 0) return "all'inizio della partita";
  return daysBefore === 1 ? "1 giorno prima" : `${daysBefore} giorni prima`;
}

/** Le regole in una frase, per lo staff: «5 giorni prima, alla stessa ora della partita» / «2 giorni prima, alle 21:00». */
export function rulesSummary(rules: Pick<ReportingRules, "daysBefore" | "closingTime">): string {
  if (rules.daysBefore === 0) return rules.closingTime ? `il giorno della partita alle ${rules.closingTime} (al più tardi all'inizio)` : "all'inizio della partita";
  return `${daysBeforePhrase(rules.daysBefore)}, ${rules.closingTime ? `alle ${rules.closingTime}` : "alla stessa ora della partita"}`;
}

/** Perché il genitore non può segnalare per una partita, da mostrargli; null se può. */
export function parentBlockMessage(state: ReportingState, rules: Pick<ReportingRules, "daysBefore">): string | null {
  switch (state.kind) {
    case "open":
      return null;
    case "hidden":
      return "Per questa partita le assenze non si segnalano dal link: per avvisare, scrivi all'allenatore.";
    case "paused":
      return "Le segnalazioni sono sospese: per avvisare, scrivi all'allenatore.";
    case "closed":
      return state.manual
        ? "Le segnalazioni per questa partita sono state chiuse dall'allenatore: per avvisare, scrivi all'allenatore."
        : `Le segnalazioni per questa partita sono chiuse: si possono fare fino ${rules.daysBefore === 0 ? "all'inizio della partita" : `a ${daysBeforePhrase(rules.daysBefore)}`}. Per avvisare, scrivi all'allenatore.`;
  }
}

/** Sotto una partita chiusa, nella pagina del genitore. */
export function parentClosedNote(state: ReportingState, rules: Pick<ReportingRules, "daysBefore">): string | null {
  switch (state.kind) {
    case "open":
    case "hidden":
      return null;
    case "paused":
      return "Segnalazioni sospese: per avvisare, scrivi all'allenatore.";
    case "closed":
      return state.manual
        ? "Segnalazioni chiuse dall'allenatore: per avvisare, scrivi all'allenatore."
        : rules.daysBefore === 0
          ? "Segnalazioni chiuse (all'inizio della partita): per avvisare, scrivi all'allenatore."
          : `Segnalazioni chiuse (${daysBeforePhrase(rules.daysBefore)} della partita): per avvisare, scrivi all'allenatore.`;
  }
}

/** Una scelta per una partita che non cambia niente rispetto alle regole: non serve tenerla. */
export function isPlainMatchReporting(setting: Pick<MatchReporting, "closesAt" | "hidden" | "message">): boolean {
  return setting.closesAt === null && !setting.hidden && setting.message === null;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Lettura dall'archivio: quello che arriva si controlla sempre, e se qualcosa non torna valgono le regole di serie.

function asObject(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const textOrNull = (value: unknown) => (typeof value === "string" && value ? value : null);

export function parseReportingRules(raw: string | null | undefined): ReportingRules {
  const value = asObject(raw);
  if (!value) return DEFAULT_REPORTING_RULES;
  const days = value.daysBefore;
  return {
    daysBefore: Number.isInteger(days) && (days as number) >= 0 && (days as number) <= MAX_DAYS_BEFORE ? (days as number) : DEFAULT_REPORTING_RULES.daysBefore,
    closingTime: isClockTime(value.closingTime) ? value.closingTime : null,
    paused: value.paused === true,
    notice: normalizeParentText(value.notice, MAX_NOTICE_LENGTH),
    updatedAt: textOrNull(value.updatedAt),
    updatedBy: textOrNull(value.updatedBy),
  };
}

export function serializeReportingRules(rules: ReportingRules): string {
  return JSON.stringify(rules);
}

export function parseMatchReporting(matchId: string, raw: string | null | undefined): MatchReporting | null {
  const value = asObject(raw);
  if (!value) return null;
  return {
    matchId,
    closesAt: isLocalDateTime(value.closesAt) ? value.closesAt : null,
    hidden: value.hidden === true,
    message: normalizeParentText(value.message, MAX_MATCH_MESSAGE_LENGTH),
    updatedAt: textOrNull(value.updatedAt) ?? new Date(0).toISOString(),
    updatedBy: textOrNull(value.updatedBy),
  };
}

export function serializeMatchReporting(setting: MatchReporting): string {
  const { closesAt, hidden, message, updatedAt, updatedBy } = setting;
  return JSON.stringify({ closesAt, hidden, message, updatedAt, updatedBy });
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Quello che arriva dai moduli dello staff.

export type RulesInputResult = { ok: true; rules: Omit<ReportingRules, "updatedAt" | "updatedBy"> } | { ok: false; error: string };

/** Le regole come le scrive lo staff: giorni (0–14), ora (quella della partita o una fissa), pausa, avviso. */
export function rulesFromInput(input: { daysBefore: unknown; closingMode: unknown; closingTime: unknown; paused: unknown; notice: unknown }): RulesInputResult {
  const days = typeof input.daysBefore === "string" && /^\d{1,2}$/.test(input.daysBefore.trim()) ? Number(input.daysBefore.trim()) : NaN;
  if (!Number.isInteger(days) || days < 0 || days > MAX_DAYS_BEFORE) {
    return { ok: false, error: `I giorni prima della partita vanno da 0 a ${MAX_DAYS_BEFORE}.` };
  }
  let closingTime: string | null = null;
  if (input.closingMode === "fixed") {
    const time = typeof input.closingTime === "string" ? input.closingTime.trim() : "";
    if (!isClockTime(time)) return { ok: false, error: "Scrivi l'ora di chiusura così: 21:00." };
    closingTime = time;
  }
  return {
    ok: true,
    rules: {
      daysBefore: days,
      closingTime,
      paused: input.paused === true || input.paused === "on" || input.paused === "true",
      notice: normalizeParentText(input.notice, MAX_NOTICE_LENGTH),
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Il promemoria per il gruppo dei genitori.

export interface ReminderEntry {
  /** «sab 31 ott, 18:00» */
  when: string;
  /** «U15 vs Pol. Codroipo» */
  title: string;
  /** «lun 26 ott, 18:00» */
  deadline: string;
}

/**
 * Il messaggio da mandare nel gruppo dei genitori: le prossime partite per cui si può ancora segnalare, con la scadenza. Mai nomi
 * né link (ognuno ha il suo, personale). Null se non c'è niente da ricordare.
 */
export function reminderMessage(entries: readonly ReminderEntry[]): string | null {
  if (entries.length === 0) return null;
  return [
    "Promemoria assenze: se una ragazza non potrà esserci a una di queste partite, segnatelo dal vostro link personale entro la scadenza.",
    ...entries.map((entry) => `• ${entry.when} · ${entry.title}: entro ${entry.deadline}`),
    "Chi ci sarà non deve fare niente. Non trovate più il link? Chiedetelo all'allenatore.",
  ].join("\n");
}
