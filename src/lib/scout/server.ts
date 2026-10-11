import "server-only";
import { notFound } from "next/navigation";
import { getActiveRepo } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guard";
import { isScoutable } from "@/lib/scout/match";

/**
 * Per le pagine dello Scout che riguardano una partita: permesso «Scout»
 * (che un Admin può avere o no) e partita esistente, di U14/U15 e non un
 * torneo. Va chiamata in ogni pagina e non solo nel layout: il layout non
 * viene rieseguito quando si naviga da una pagina all'altra dello stesso
 * gruppo.
 */
export async function requireScoutMatch(matchId: string) {
  const session = await requireStaffPage("scout");
  const repo = await getActiveRepo();
  const match = await repo.getMatch(matchId);
  if (!match || !isScoutable(match)) notFound();
  return { session, repo, match };
}
