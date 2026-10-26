import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import type { Match } from "@/lib/types";
import { answerWhen } from "./format";
import { autoDeadline, matchStart, reportingState, rulesSummary, type MatchReporting, type ReportingRules, type ReportingState } from "./reporting";

/** «lun 26 ott, 18:00»: data e ora («AAAA-MM-GGTHH:mm», ora italiana) in breve, per lo staff e per il promemoria. */
export function shortWhen(localDateTime: string): string {
  return format(parseISO(localDateTime), "EEE d MMM', 'HH:mm", { locale: it });
}

export type ReportingTone = "success" | "danger" | "neutral" | "warning";

/**
 * Quello che lo staff vede e può fare sulle segnalazioni di una partita, già scritto in italiano (serve sia alla pagina «Assenze
 * alle partite» sia alla scheda della partita, e passa così com'è ai pulsanti nel browser).
 */
export interface ReportingView {
  matchId: string;
  state: ReportingState;
  /** «Aperte fino a lun 26 ott, 18:00», «Chiuse a mano», «Non chieste ai genitori»… */
  status: string;
  tone: ReportingTone;
  /** Da dove viene: «Scadenza automatica: 5 giorni prima, alla stessa ora della partita» / «Scadenza scelta a mano». */
  source: string;
  /** «Cambiata da Marco · 26 ott, 14:30», se qualcuno l'ha cambiata a mano. */
  changed: string | null;
  closesAt: string | null;
  hidden: boolean;
  message: string | null;
  /** L'inizio della partita, e in breve: la scadenza non può andare oltre. */
  start: string;
  startLabel: string;
  /** La scadenza delle regole, e se adesso sarebbe ancora aperta (per «Torna alla scadenza automatica»). */
  autoDeadline: string;
  autoDeadlineLabel: string;
  autoOpen: boolean;
  /** Le segnalazioni sono sospese per tutte le partite. */
  paused: boolean;
}

export function reportingView(match: Pick<Match, "id" | "matchDate">, rules: ReportingRules, setting: MatchReporting | null, now: string): ReportingView {
  const state = reportingState(match, now, rules, setting);
  const auto = autoDeadline(match, rules);
  const start = matchStart(match);

  let status: string;
  let tone: ReportingTone;
  switch (state.kind) {
    case "hidden":
      status = "Non chieste ai genitori";
      tone = "neutral";
      break;
    case "paused":
      status = "Sospese per tutte le partite";
      tone = "warning";
      break;
    case "open":
      status = `Aperte fino a ${shortWhen(state.deadline)}`;
      tone = "success";
      break;
    case "closed":
      status = state.manual ? `Chiuse a mano dal ${shortWhen(state.deadline)}` : `Chiuse dal ${shortWhen(state.deadline)}`;
      tone = state.manual ? "danger" : "neutral";
      break;
  }

  const source = setting?.hidden
    ? "Dal link dei genitori questa partita non si vede."
    : setting?.closesAt
      ? `Scadenza scelta a mano (con le regole sarebbe ${shortWhen(auto)}).`
      : `Scadenza automatica: ${rulesSummary(rules)}.`;

  return {
    matchId: match.id,
    state,
    status,
    tone,
    source,
    changed: setting ? `Cambiata da ${setting.updatedBy ?? "qualcuno dello staff"} · ${answerWhen(setting.updatedAt)}` : null,
    closesAt: setting?.closesAt ?? null,
    hidden: setting?.hidden ?? false,
    message: setting?.message ?? null,
    start,
    startLabel: shortWhen(start),
    autoDeadline: auto,
    autoDeadlineLabel: shortWhen(auto),
    autoOpen: now < auto,
    paused: rules.paused,
  };
}
