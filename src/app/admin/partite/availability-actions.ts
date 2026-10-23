"use server";

import { revalidatePath } from "next/cache";
import { getActiveRepo } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guard";
import { isAvailabilityTableMissing } from "@/lib/availability/missing";
import { appliesToAthlete, normalizeNote, parseReason } from "@/lib/availability/rules";

/**
 * Le non disponibilità di una partita, dalla sua pagina: lo staff può aggiungerne una (per esempio quando il genitore scrive in
 * chat) o toglierne una, anche se l'ha segnata il genitore. Ogni azione ricontrolla il permesso «Partite» e lavora solo su una
 * partita di U14/U15 e su un'atleta che la riguarda.
 */

const idOf = (formData: FormData, name: string) => formData.get(name)?.toString().trim().slice(0, 100) ?? "";

function refresh(matchId: string) {
  revalidatePath(`/admin/partite/${matchId}`);
  revalidatePath("/admin/partite");
}

/** Segna un'atleta non disponibile per la partita, a nome dello staff. */
export async function setStaffUnavailabilityAction(formData: FormData) {
  const session = await requireStaffPage("partite");
  const matchId = idOf(formData, "matchId");
  const athleteId = idOf(formData, "athleteId");
  const repo = await getActiveRepo();
  const [match, athlete] = await Promise.all([repo.getMatch(matchId), repo.getAthlete(athleteId)]);
  if (match && athlete && match.team === "u14u15" && athlete.isActive && appliesToAthlete(match, athlete)) {
    try {
      await repo.setMatchUnavailability({
        matchId,
        athleteId,
        reason: parseReason(formData.get("reason")),
        note: normalizeNote(formData.get("note")),
        reportedBy: "staff",
        updatedBy: session.sub,
      });
    } catch (error) {
      if (!isAvailabilityTableMissing(error)) throw error;
    }
  }
  refresh(matchId);
}

/** Toglie la segnalazione (l'atleta torna disponibile). */
export async function clearStaffUnavailabilityAction(formData: FormData) {
  await requireStaffPage("partite");
  const matchId = idOf(formData, "matchId");
  const athleteId = idOf(formData, "athleteId");
  const repo = await getActiveRepo();
  try {
    await repo.clearMatchUnavailability(matchId, athleteId);
  } catch (error) {
    if (!isAvailabilityTableMissing(error)) throw error;
  }
  refresh(matchId);
}
