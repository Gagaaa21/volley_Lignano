"use server";

import { revalidatePath } from "next/cache";
import { getRepo } from "@/lib/db";
import type { Repo } from "@/lib/db/repo";
import { isAppSettingsMissing, isAvailabilityTableMissing } from "@/lib/availability/missing";
import { DEFAULT_REPORTING_RULES, type MatchReporting, type ReportingRules } from "@/lib/availability/reporting";
import { appliesToAthlete, canParentChange, canUseFamilyLink, normalizeAbsence } from "@/lib/availability/rules";
import { familyLinkPath, isFamilyToken } from "@/lib/availability/token";
import { nowLocalIso } from "@/lib/today";
import type { Athlete, Match } from "@/lib/types";

/**
 * Le azioni della pagina del genitore. Sono raggiungibili da chiunque, quindi ricontrollano tutto da sole: il codice del link (è
 * l'unica chiave: dice di quale atleta si parla), che la partita sia della sua squadra e categoria e che le segnalazioni siano
 * ancora aperte (le regole e le scelte dello staff per quella partita: scadenza, chiusura a mano, pausa, partita non chiesta). Tutto
 * quello che arriva dal browser si considera non fidato; la risposta non dice mai altro che se è andata bene.
 */

export type AvailabilityActionResult = { ok: true } | { ok: false; error: string };

const INVALID_LINK = "Questo link non funziona più: chiedi all'allenatore di mandartene uno nuovo.";
const GENERIC = "Non sono riuscito a salvare: riprova tra poco.";
const NOT_READY = "Il servizio non è ancora attivo: riprova più tardi o sentite l'allenatore.";

type Target = { ok: true; repo: Repo; athlete: Athlete; match: Match } | { ok: false; error: string };

/** Dal codice e dalla partita all'atleta e alla partita giusti, se il genitore può ancora segnalare per quella partita. */
async function resolveTarget(token: unknown, matchId: unknown): Promise<Target> {
  if (!isFamilyToken(token) || typeof matchId !== "string" || matchId.length === 0 || matchId.length > 100) {
    return { ok: false, error: INVALID_LINK };
  }
  // Sempre il database reale: chi apre un link non ha una sessione, e non deve mai dipendere dalla modalità prova di nessuno.
  const repo = await getRepo();
  const athlete = await repo.findAthleteByFamilyToken(token);
  if (!athlete || !canUseFamilyLink(athlete)) return { ok: false, error: INVALID_LINK };

  const match = await repo.getMatch(matchId);
  if (!match || !appliesToAthlete(match, athlete)) return { ok: false, error: "Questa partita non c'è più." };

  let rules: ReportingRules = DEFAULT_REPORTING_RULES;
  let setting: MatchReporting | null = null;
  try {
    [rules, [setting = null]] = await Promise.all([repo.getReportingRules(), repo.listMatchReporting([match.id])]);
  } catch (error) {
    // Senza la tabella delle impostazioni valgono le regole di serie, come nella pagina.
    if (!isAppSettingsMissing(error)) throw error;
  }
  const allowed = canParentChange(match, nowLocalIso(), rules, setting);
  if (!allowed.ok) return allowed;
  return { ok: true, repo, athlete, match };
}

function failure(error: unknown): AvailabilityActionResult {
  if (isAvailabilityTableMissing(error)) return { ok: false, error: NOT_READY };
  // Solo il messaggio, mai gli argomenti: tra questi c'è il codice del link.
  console.error("Assenze: azione non riuscita:", error instanceof Error ? error.message : "errore sconosciuto");
  return { ok: false, error: GENERIC };
}

/**
 * «Non ci sarà»: il genitore segnala l'assenza, con un motivo (uno di quelli previsti) e una nota breve se vuole. Scrivendola di nuovo
 * cambia motivo e nota, anche se l'aveva scritta l'allenatore.
 */
export async function reportAbsenceAction(token: string, matchId: string, reason: string | null, note: string): Promise<AvailabilityActionResult> {
  try {
    const target = await resolveTarget(token, matchId);
    if (!target.ok) return target;
    await target.repo.setMatchAvailability({
      matchId: target.match.id,
      athleteId: target.athlete.id,
      ...normalizeAbsence({ reason, note }),
      answeredBy: "parent",
      updatedBy: null,
    });
    revalidatePath(familyLinkPath(token));
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/** Il genitore toglie l'assenza (la figlia ci sarà), con le stesse regole: solo finché le segnalazioni sono aperte. */
export async function clearAbsenceAction(token: string, matchId: string): Promise<AvailabilityActionResult> {
  try {
    const target = await resolveTarget(token, matchId);
    if (!target.ok) return target;
    await target.repo.clearMatchAvailability(target.match.id, target.athlete.id);
    revalidatePath(familyLinkPath(token));
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}
