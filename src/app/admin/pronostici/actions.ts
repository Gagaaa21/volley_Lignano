"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getActiveRepo } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guard";
import { parseSetScoresFromFormData } from "@/lib/setScores";
import { isMatchLocked } from "@/lib/predictions";

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
  if (match.isTournament) return { error: "Non si pronosticano i tornei." };
  if (isMatchLocked(match.matchDate)) {
    return { error: "Non puoi più pronosticare o modificare: la partita è già iniziata." };
  }

  const result = parseSetScoresFromFormData(formData);
  if (result.error) return { error: result.error };
  if (!result.setScores || result.setScores.length === 0) {
    return { error: "Inserisci un pronostico completo: una squadra deve arrivare a 3 set." };
  }

  await repo.upsertPrediction(matchId, session.sub, { setScores: result.setScores });

  revalidatePath("/admin/pronostici");
  revalidatePath(`/admin/pronostici/${matchId}`);
  redirect("/admin/pronostici");
}
