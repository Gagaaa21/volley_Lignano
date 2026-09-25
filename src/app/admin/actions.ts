"use server";

import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/guard";
import { setSessionCookie } from "@/lib/auth/session";

/** Cambia la squadra attiva per tutta la sessione (switcher nell'header):
 * Allenamenti, Partite, Schede e Presenze mostrano da qui in poi i dati
 * della squadra scelta, finché non viene cambiata di nuovo o si esce.
 * Riporta sulla stessa pagina da cui è stato aperto lo switcher, così non si
 * perde il punto in cui si era. */
export async function setActiveTeamAction(formData: FormData): Promise<void> {
  const session = await requireStaff();
  const team = formData.get("team")?.toString() === "minivolley" ? "minivolley" : "u14u15";
  const redirectTo = formData.get("redirectTo")?.toString() || "/admin";

  await setSessionCookie({ ...session, activeTeam: team });
  redirect(redirectTo);
}
