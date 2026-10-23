"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getActiveRepo } from "@/lib/db";
import { requireStaffPage, resolveActiveTeam } from "@/lib/auth/guard";
import { isAvailabilityTableMissing } from "@/lib/availability/missing";
import { canUseFamilyLink } from "@/lib/availability/rules";
import { newFamilyToken } from "@/lib/availability/token";

/**
 * I link per i genitori si gestiscono dalle Atlete, quindi con il permesso «Presenze», e solo per Under 14 e Under 15.
 * Ogni azione ricontrolla il permesso da sola e lavora sull'atleta indicata solo se può avere un link.
 */

const PAGE = "/admin/presenze/atlete/link-genitori";

async function guard() {
  const session = await requireStaffPage("presenze");
  if ((await resolveActiveTeam(session)) !== "u14u15") redirect("/admin/presenze/atlete");
  return getActiveRepo();
}

/** Finché le tabelle non ci sono la pagina lo spiega da sola: qui basta non fallire. */
async function guarded(work: () => Promise<void>) {
  try {
    await work();
  } catch (error) {
    if (!isAvailabilityTableMissing(error)) throw error;
  }
  revalidatePath(PAGE);
}

const athleteIdOf = (formData: FormData) => formData.get("athleteId")?.toString().trim().slice(0, 100) ?? "";

/** Crea il link di un'atleta che non ce l'ha. */
export async function createFamilyLinkAction(formData: FormData) {
  const repo = await guard();
  const athleteId = athleteIdOf(formData);
  await guarded(async () => {
    const athlete = await repo.getAthlete(athleteId);
    if (athlete && canUseFamilyLink(athlete)) await repo.ensureAthleteFamilyLink(athlete.id, newFamilyToken());
  });
}

/** Crea i link a tutte le atlete attive che non ne hanno uno. */
export async function createMissingFamilyLinksAction() {
  const repo = await guard();
  await guarded(async () => {
    const [athletes, links] = await Promise.all([repo.listAthletes({ team: "u14u15" }), repo.listAthleteFamilyLinks()]);
    const have = new Set(links.map((link) => link.athleteId));
    await Promise.all(
      athletes
        .filter((athlete) => canUseFamilyLink(athlete) && !have.has(athlete.id))
        .map((athlete) => repo.ensureAthleteFamilyLink(athlete.id, newFamilyToken())),
    );
  });
}

/** Sostituisce il codice del link: quello vecchio smette subito di funzionare. */
export async function rotateFamilyLinkAction(formData: FormData) {
  const repo = await guard();
  const athleteId = athleteIdOf(formData);
  await guarded(async () => {
    const athlete = await repo.getAthlete(athleteId);
    if (athlete && canUseFamilyLink(athlete)) await repo.rotateAthleteFamilyLink(athlete.id, newFamilyToken());
  });
}
