"use server";

import { redirect } from "next/navigation";
import { getActiveRepo } from "@/lib/db";
import { requireStaff } from "@/lib/auth/guard";
import { setSessionCookie } from "@/lib/auth/session";
import { TEAMS } from "@/lib/types";

/** Cambia la squadra attiva per tutta la sessione (switcher nell'header):
 * Allenamenti, Partite, Schede e Presenze mostrano da qui in poi i dati
 * della squadra scelta, finché non viene cambiata di nuovo o si esce.
 * Riporta sulla stessa pagina da cui è stato aperto lo switcher, così non si
 * perde il punto in cui si era. Un Admin non può passare a una squadra che
 * il Developer non gli ha assegnato (Centro di controllo → Permessi), anche
 * forzando la richiesta: la richiesta viene semplicemente ignorata. */
export async function setActiveTeamAction(formData: FormData): Promise<void> {
  const session = await requireStaff();
  const team = formData.get("team")?.toString() === "minivolley" ? "minivolley" : "u14u15";
  const redirectTo = formData.get("redirectTo")?.toString() || "/admin";

  if (session.role !== "dev") {
    const repo = await getActiveRepo();
    const staff = await repo.getStaffById(session.sub);
    const allowedTeams = staff?.allowedTeams ?? TEAMS;
    if (!allowedTeams.includes(team)) redirect(redirectTo);
  }

  await setSessionCookie({ ...session, activeTeam: team });
  redirect(redirectTo);
}
