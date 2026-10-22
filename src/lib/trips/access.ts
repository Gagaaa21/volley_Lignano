import "server-only";
import { NextResponse } from "next/server";
import { getActiveRepo } from "@/lib/db";
import type { Repo } from "@/lib/db/repo";
import { getOwnStaff } from "@/lib/auth/guard";
import { getSession, type SessionPayload } from "@/lib/auth/session";
import { isTripTableMissing } from "@/lib/trips/missing";
import type { Match } from "@/lib/types";

export type TripAccess =
  | { ok: true; session: SessionPayload; match: Match; repo: Repo }
  | { ok: false; response: NextResponse };

function fail(message: string, status: number): TripAccess {
  return { ok: false, response: NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } }) };
}

/**
 * Chi può leggere le trasferte di una partita da fuori delle pagine (il riepilogo in PDF): lo stesso controllo di
 * requireStaffPage("trasferte"), ma senza redirect — una richiesta del client deve ricevere uno stato HTTP, non una pagina di
 * accesso. Sezione «super riservata»: serve il permesso «Trasferte» (il Developer ce l'ha sempre), la partita deve essere di
 * U14/U15 e di una squadra che l'account può gestire.
 */
export async function requireTripAccess(matchId: string): Promise<TripAccess> {
  const session = await getSession();
  if (!session) return fail("Sessione scaduta: accedi di nuovo.", 401);

  let allowedTeams: readonly string[] | null = null; // null = il Developer, senza limiti
  if (session.role !== "dev") {
    const staff = await getOwnStaff(session.sub);
    if (!staff || !staff.allowedPages.includes("trasferte")) return fail("Non hai accesso alle trasferte.", 403);
    allowedTeams = staff.allowedTeams;
  }

  const repo = await getActiveRepo();
  const match = await repo.getMatch(matchId);
  if (!match) return fail("Partita non trovata.", 404);
  if (match.team !== "u14u15") return fail("Le trasferte sono solo per U14/U15.", 400);
  if (allowedTeams && !allowedTeams.includes(match.team)) return fail("Non hai accesso a questa squadra.", 403);

  return { ok: true, session, match, repo };
}

/** Come withScoutStore: se le tabelle non sono ancora state create su Supabase risponde con un messaggio chiaro. */
export async function withTripStore<T>(run: () => Promise<T>): Promise<T | NextResponse> {
  try {
    return await run();
  } catch (error) {
    if (!isTripTableMissing(error)) throw error;
    return NextResponse.json(
      { error: "Le tabelle delle trasferte non sono ancora state create su Supabase: va eseguito l'aggiornamento del database." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
