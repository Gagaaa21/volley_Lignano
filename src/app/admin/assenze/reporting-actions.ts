"use server";

import { revalidatePath } from "next/cache";
import { getActiveRepo } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guard";
import { isAppSettingsMissing } from "@/lib/availability/missing";
import {
  MAX_MATCH_MESSAGE_LENGTH,
  isLocalDateTime,
  isPlainMatchReporting,
  matchStart,
  normalizeParentText,
  rulesFromInput,
} from "@/lib/availability/reporting";
import { shortWhen } from "@/lib/availability/reportingView";
import { nowLocalIso } from "@/lib/today";

/**
 * Le segnalazioni dei genitori, gestite dallo staff con il permesso «Partite» (l'allenatore e il Developer): le regole per tutte le
 * partite e, partita per partita, chiudere adesso, riaprire, scegliere la scadenza, non chiedere niente ai genitori, lasciare loro
 * un messaggio. Ogni azione ricontrolla permesso e dati da sola; chi l'ha cambiata e quando restano scritti.
 */

const STORE_MISSING =
  "Manca la tabella delle impostazioni nel database (app_settings): il Developer trova l'SQL da incollare nella sezione «Assenze».";

export type ReportingResult = { ok: true } | { ok: false; error: string };

export type ReportingChange =
  /** Chiude adesso le segnalazioni della partita. */
  | { type: "close" }
  /** Le riapre fino all'inizio della partita. */
  | { type: "reopen" }
  /** Torna alla scadenza delle regole. */
  | { type: "auto" }
  | { type: "deadline"; closesAt: string }
  | { type: "hidden"; hidden: boolean }
  | { type: "message"; message: string };

function revalidateReporting(matchId?: string) {
  revalidatePath("/admin/assenze");
  if (matchId) revalidatePath(`/admin/assenze/partita/${matchId}`);
}

export async function updateMatchReportingAction(matchId: string, change: ReportingChange): Promise<ReportingResult> {
  const session = await requireStaffPage("partite");
  const id = typeof matchId === "string" ? matchId.trim().slice(0, 100) : "";
  const repo = await getActiveRepo();
  const match = id ? await repo.getMatch(id) : null;
  if (!match || match.team !== "u14u15") return { ok: false, error: "Partita non trovata." };
  const start = matchStart(match);

  try {
    const [current] = await repo.listMatchReporting([id]);
    const next = {
      closesAt: current?.closesAt ?? null,
      closesAtBy: current?.closesAtBy ?? null,
      hidden: current?.hidden ?? false,
      message: current?.message ?? null,
      messageBy: current?.messageBy ?? null,
    };
    // Chi chiude o scrive si vede con il nome del suo account («chiuse da Gaga», «Da Gaga: …»), non con un ruolo.
    const me = session.fullName;
    switch (change?.type) {
      case "close":
        next.closesAt = nowLocalIso();
        next.closesAtBy = me;
        break;
      case "reopen":
        next.closesAt = start;
        next.closesAtBy = me;
        break;
      case "auto":
        next.closesAt = null;
        next.closesAtBy = null;
        break;
      case "deadline":
        if (!isLocalDateTime(change.closesAt)) return { ok: false, error: "Scegli il giorno e l'ora della scadenza." };
        if (change.closesAt > start) return { ok: false, error: `La scadenza non può essere dopo l'inizio della partita (${shortWhen(start)}).` };
        next.closesAt = change.closesAt;
        next.closesAtBy = me;
        break;
      case "hidden":
        next.hidden = change.hidden === true;
        break;
      case "message": {
        const message = normalizeParentText(change.message, MAX_MATCH_MESSAGE_LENGTH);
        // Il messaggio resta di chi l'ha scritto finché nessuno lo cambia.
        if (message !== next.message) next.messageBy = message ? me : null;
        next.message = message;
        break;
      }
      default:
        return { ok: false, error: "Richiesta non valida." };
    }
    // Se non resta niente di diverso dalle regole non serve tenerla.
    if (isPlainMatchReporting(next)) await repo.clearMatchReporting(id);
    else await repo.saveMatchReporting({ matchId: id, ...next, updatedAt: new Date().toISOString(), updatedBy: session.fullName });
  } catch (error) {
    if (isAppSettingsMissing(error)) return { ok: false, error: STORE_MISSING };
    throw error;
  }
  revalidateReporting(id);
  return { ok: true };
}

export interface RulesFormState {
  ok?: boolean;
  error?: string;
}

/** Le regole per tutte le partite: giorni prima, ora di chiusura, pausa, avviso per i genitori. */
export async function saveReportingRulesAction(_previous: RulesFormState, formData: FormData): Promise<RulesFormState> {
  const session = await requireStaffPage("partite");
  const parsed = rulesFromInput({
    daysBefore: formData.get("daysBefore"),
    closingMode: formData.get("closingMode"),
    closingTime: formData.get("closingTime"),
    paused: formData.get("paused"),
    notice: formData.get("notice"),
  });
  if (!parsed.ok) return { error: parsed.error };
  const repo = await getActiveRepo();
  try {
    // L'avviso resta di chi l'ha scritto finché nessuno lo cambia (anche se un altro cambia i giorni o la pausa).
    const current = await repo.getReportingRules();
    const notice = parsed.rules.notice;
    const noticeBy = notice ? (notice === current.notice ? (current.noticeBy ?? session.fullName) : session.fullName) : null;
    await repo.saveReportingRules({ ...parsed.rules, noticeBy, updatedAt: new Date().toISOString(), updatedBy: session.fullName });
  } catch (error) {
    if (isAppSettingsMissing(error)) return { error: STORE_MISSING };
    throw error;
  }
  revalidateReporting();
  revalidatePath("/admin/assenze/regole");
  revalidatePath("/admin/assenze/partita/[id]", "page");
  return { ok: true };
}
