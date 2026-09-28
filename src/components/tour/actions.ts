"use server";

import { requireStaff } from "@/lib/auth/guard";
import { setSessionCookie } from "@/lib/auth/session";
import { getRepo } from "@/lib/db";

/**
 * Segna il tour guidato come visto — chiamata direttamente dal gestore
 * onClick di "Salta"/"Fine" in Tour.tsx (non da un <form>, a differenza di
 * ogni altra server action del progetto): l'utente può chiudere il tour da
 * una pagina qualunque e la pagina non deve spostarsi né ricaricarsi, cosa
 * che un submit di form legato a un redirect() garantirebbe gratis altrove
 * ma qui sarebbe solo un effetto collaterale indesiderato. Aggiorna sia
 * repo (persistente) sia il cookie di sessione (letto da Tour a ogni
 * caricamento pagina): senza il secondo, un valore stantio nel cookie
 * (valido 14 giorni) farebbe ripartire il tour al prossimo refresh.
 */
export async function finishTourAction(): Promise<void> {
  const session = await requireStaff();
  if (session.hasSeenGuide) return;

  const repo = await getRepo();
  await repo.markGuideSeen(session.sub);
  await setSessionCookie({ ...session, hasSeenGuide: true });
}
