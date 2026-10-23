"use server";

import { revalidatePath } from "next/cache";
import { getActiveRepo } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guard";
import { isAvailabilityTableMissing } from "@/lib/availability/missing";
import { appliesToAthlete, normalizeAnswer, parseStatus } from "@/lib/availability/rules";

/**
 * La risposta di un'atleta per una partita, dalla scheda della partita: l'allenatore scrive «Ci sarà» o «Non ci sarà» (con motivo
 * e nota) o la toglie (l'atleta torna «senza risposta»), sempre, a ogni ora e a partita finita, anche se l'aveva scritta il
 * genitore. Ricontrolla il permesso «Partite» e lavora solo su una partita di U14/U15 e su un'atleta attiva che la riguarda.
 */

export type StaffAnswerResult = { ok: true } | { ok: false; error: string };

const plainId = (value: unknown) => (typeof value === "string" ? value.trim().slice(0, 100) : "");

/** `status` nullo toglie la risposta. */
export async function setStaffAnswerAction(
  matchId: string,
  athleteId: string,
  status: string | null,
  reason: string | null,
  note: string,
): Promise<StaffAnswerResult> {
  const session = await requireStaffPage("partite");
  const match = plainId(matchId);
  const athlete = plainId(athleteId);
  const parsed = status === null ? null : parseStatus(status);
  if (status !== null && !parsed) return { ok: false, error: "Risposta non valida." };

  const repo = await getActiveRepo();
  try {
    const [matchRow, athleteRow] = await Promise.all([repo.getMatch(match), repo.getAthlete(athlete)]);
    if (!matchRow || matchRow.team !== "u14u15") return { ok: false, error: "Partita non trovata." };
    if (!athleteRow || !athleteRow.isActive || !appliesToAthlete(matchRow, athleteRow)) {
      return { ok: false, error: "Questa atleta non riguarda la partita." };
    }
    if (parsed === null) await repo.clearMatchAvailability(match, athlete);
    else {
      await repo.setMatchAvailability({
        matchId: match,
        athleteId: athlete,
        ...normalizeAnswer({ status: parsed, reason, note }),
        answeredBy: "staff",
        updatedBy: session.sub,
      });
    }
  } catch (error) {
    if (isAvailabilityTableMissing(error)) {
      return { ok: false, error: "Mancano le tabelle della presenza nel database: va eseguito l'aggiornamento (vedi supabase/schema.sql)." };
    }
    throw error;
  }
  revalidatePath(`/admin/partite/${match}`);
  revalidatePath("/admin/partite");
  revalidatePath("/admin");
  return { ok: true };
}
