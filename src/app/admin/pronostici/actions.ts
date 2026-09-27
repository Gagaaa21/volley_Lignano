"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getActiveRepo } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guard";
import { parseSetScoresFromFormData, parseTournamentGamesJson } from "@/lib/setScores";
import { isMatchDayToday, isMatchLocked } from "@/lib/predictions";

export interface PredictionFormState {
  error?: string;
}

export async function savePredictionAction(
  _prevState: PredictionFormState,
  formData: FormData,
): Promise<PredictionFormState> {
  const session = await requireStaffPage("pronostici");
  const matchId = formData.get("matchId")?.toString();
  if (!matchId) return { error: "Partita non trovata." };

  const repo = await getActiveRepo();
  const match = await repo.getMatch(matchId);
  if (!match) return { error: "Partita non trovata." };
  if (isMatchLocked(match.matchDate)) {
    return { error: "Non puoi più pronosticare o modificare: la partita è già iniziata." };
  }
  if (!isMatchDayToday(match.matchDate)) {
    return { error: "Puoi pronosticare questa partita solo il giorno stesso in cui si gioca." };
  }

  if (match.isTournament) {
    const tournamentResult = parseTournamentGamesJson(formData.get("tournamentGames")?.toString() ?? "[]", {
      requireCompleteScore: true,
    });
    if (tournamentResult.error) return { error: tournamentResult.error };
    if (!tournamentResult.tournamentGames || tournamentResult.tournamentGames.length === 0) {
      return { error: "Inserisci almeno un pronostico completo: avversaria e punteggio." };
    }
    await repo.upsertPrediction(matchId, session.sub, {
      setScores: null,
      tournamentGames: tournamentResult.tournamentGames,
    });
  } else {
    const result = parseSetScoresFromFormData(formData);
    if (result.error) return { error: result.error };
    if (!result.setScores || result.setScores.length === 0) {
      return { error: "Inserisci un pronostico completo: una squadra deve arrivare a 3 set." };
    }
    await repo.upsertPrediction(matchId, session.sub, { setScores: result.setScores, tournamentGames: null });
  }

  revalidatePath("/admin/pronostici");
  revalidatePath(`/admin/pronostici/${matchId}`);
  redirect("/admin/pronostici");
}
