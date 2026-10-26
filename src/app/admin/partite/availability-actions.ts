"use server";

import { revalidatePath } from "next/cache";
import { getActiveRepo } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guard";
import { isAvailabilityTableMissing } from "@/lib/availability/missing";
import { appliesToAthlete, normalizeAbsence } from "@/lib/availability/rules";

/**
 * L'assenza di un'atleta da una partita, dalla scheda della partita: l'allenatore la segna («Non ci sarà», con motivo e nota) o
 * la toglie (ci sarà), sempre, a ogni ora e a partita finita, anche se l'aveva scritta il genitore: la scadenza vale solo per
 * il link dei genitori. Ricontrolla il permesso «Partite» e lavora solo su una partita di U14/U15 e su un'atleta attiva che la
 * riguarda.
 */

export type StaffAbsenceResult = { ok: true } | { ok: false; error: string };

const plainId = (value: unknown) => (typeof value === "string" ? value.trim().slice(0, 100) : "");

/** `absent` falso toglie l'assenza. */
export async function setStaffAbsenceAction(
  matchId: string,
  athleteId: string,
  absent: boolean,
  reason: string | null,
  note: string,
): Promise<StaffAbsenceResult> {
  const session = await requireStaffPage("partite");
  const match = plainId(matchId);
  const athlete = plainId(athleteId);

  const repo = await getActiveRepo();
  try {
    const [matchRow, athleteRow] = await Promise.all([repo.getMatch(match), repo.getAthlete(athlete)]);
    if (!matchRow || matchRow.team !== "u14u15") return { ok: false, error: "Partita non trovata." };
    if (!athleteRow || !athleteRow.isActive || !appliesToAthlete(matchRow, athleteRow)) {
      return { ok: false, error: "Questa atleta non riguarda la partita." };
    }
    if (!absent) await repo.clearMatchAvailability(match, athlete);
    else {
      await repo.setMatchAvailability({
        matchId: match,
        athleteId: athlete,
        ...normalizeAbsence({ reason, note }),
        answeredBy: "staff",
        updatedBy: session.sub,
      });
    }
  } catch (error) {
    if (isAvailabilityTableMissing(error)) {
      return { ok: false, error: "Manca la tabella delle assenze nel database: va eseguito l'aggiornamento (vedi supabase/schema.sql)." };
    }
    throw error;
  }
  revalidatePath(`/admin/partite/${match}`);
  revalidatePath("/admin/partite");
  revalidatePath("/admin");
  return { ok: true };
}
