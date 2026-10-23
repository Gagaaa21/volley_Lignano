"use server";

import { revalidatePath } from "next/cache";
import { getRepo } from "@/lib/db";
import type { Repo } from "@/lib/db/repo";
import { isAvailabilityTableMissing } from "@/lib/availability/missing";
import { appliesToAthlete, canParentChange, canUseFamilyLink, normalizeNote, parseReason } from "@/lib/availability/rules";
import { familyLinkPath, isFamilyToken } from "@/lib/availability/token";
import { todayIso } from "@/lib/today";
import type { Athlete, Match } from "@/lib/types";

/**
 * Le azioni della pagina del genitore. Sono raggiungibili da chiunque, quindi ognuna ricontrolla tutto da sola: il codice del
 * link (è l'unica chiave: dice di quale atleta si parla), che la partita sia della sua squadra e categoria, che si possa
 * ancora cambiare e che non sia una segnalazione dello staff. Tutto quello che arriva dal browser si considera non fidato; le
 * risposte non dicono mai altro che se è andata bene.
 */

export type AvailabilityActionResult = { ok: true } | { ok: false; error: string };

const INVALID_LINK = "Questo link non funziona più: chiedi all'allenatore di mandartene uno nuovo.";
const GENERIC = "Non sono riuscito a salvare: riprova tra poco.";
const NOT_READY = "Il servizio non è ancora attivo: riprova più tardi o sentite l'allenatore.";

type Target = { ok: true; repo: Repo; athlete: Athlete; match: Match } | { ok: false; error: string };

/** Dal codice e dalla partita all'atleta e alla partita giusti, se il genitore può davvero cambiare quella segnalazione. */
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

  const [existing] = await repo.listMatchUnavailability({ matchIds: [match.id], athleteId: athlete.id });
  const allowed = canParentChange(match, existing, todayIso());
  if (!allowed.ok) return allowed;
  return { ok: true, repo, athlete, match };
}

function failure(error: unknown): AvailabilityActionResult {
  if (isAvailabilityTableMissing(error)) return { ok: false, error: NOT_READY };
  // Solo il messaggio, mai gli argomenti: tra questi c'è il codice del link.
  console.error("Disponibilità: azione non riuscita:", error instanceof Error ? error.message : "errore sconosciuto");
  return { ok: false, error: GENERIC };
}

/** «Non ci sarà»: segna l'atleta non disponibile per la partita, con un motivo (uno di quelli previsti) e una nota breve. */
export async function reportUnavailableAction(
  token: string,
  matchId: string,
  reason: string | null,
  note: string,
): Promise<AvailabilityActionResult> {
  try {
    const target = await resolveTarget(token, matchId);
    if (!target.ok) return target;
    await target.repo.setMatchUnavailability({
      matchId: target.match.id,
      athleteId: target.athlete.id,
      reason: parseReason(reason),
      note: normalizeNote(note),
      reportedBy: "parent",
      updatedBy: null,
    });
    revalidatePath(familyLinkPath(token));
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/** «Torna disponibile»: toglie la segnalazione (solo se l'ha fatta il genitore). */
export async function clearUnavailableAction(token: string, matchId: string): Promise<AvailabilityActionResult> {
  try {
    const target = await resolveTarget(token, matchId);
    if (!target.ok) return target;
    await target.repo.clearMatchUnavailability(target.match.id, target.athlete.id);
    revalidatePath(familyLinkPath(token));
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}
