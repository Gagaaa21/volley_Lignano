import "server-only";
import { NextResponse } from "next/server";
import { getActiveRepo } from "@/lib/db";
import type { Repo } from "@/lib/db/repo";
import { getOwnStaff } from "@/lib/auth/guard";
import { getSession, type SessionPayload } from "@/lib/auth/session";
import { isScoutable } from "@/lib/scout/match";
import { isScoutTableMissing } from "@/lib/scout/missing";
import type { Match } from "@/lib/types";

export type ScoutAccess =
  | {
      ok: true;
      session: SessionPayload;
      match: Match;
      repo: Repo;
      /** Modalità prova del Developer: lo scout sta in un archivio separato e non deve mai arrivare sul sito pubblico. */
      sandboxed: boolean;
    }
  | { ok: false; response: NextResponse };

function fail(message: string, status: number): ScoutAccess {
  return { ok: false, response: NextResponse.json({ error: message }, { status }) };
}

/**
 * Chi può leggere o scrivere lo scout di una partita: lo stesso controllo di
 * requireStaffPage("scout") nelle pagine, ma senza redirect — una richiesta
 * del client deve ricevere uno stato HTTP, non una pagina di login. In più la
 * partita deve esistere, essere di campionato (o amichevole) di U14/U15 e di
 * una squadra che l'account può gestire.
 */
export async function requireScoutAccess(matchId: string): Promise<ScoutAccess> {
  const session = await getSession();
  if (!session) return fail("Sessione scaduta: accedi di nuovo.", 401);

  let allowedTeams: readonly string[] | null = null; // null = il Developer, senza limiti
  if (session.role !== "dev") {
    const staff = await getOwnStaff(session.sub);
    if (!staff || !staff.allowedPages.includes("scout")) return fail("Non hai accesso allo Scout.", 403);
    allowedTeams = staff.allowedTeams;
  }

  const repo = await getActiveRepo();
  const match = await repo.getMatch(matchId);
  if (!match) return fail("Partita non trovata.", 404);
  if (!isScoutable(match)) return fail("Lo scout è disponibile per le partite di U14/U15, non per i tornei.", 400);
  if (allowedTeams && !allowedTeams.includes(match.team)) return fail("Non hai accesso a questa squadra.", 403);

  return { ok: true, session, match, repo, sandboxed: session.role === "dev" && session.testMode === true };
}

/**
 * Esegue una lettura o una scrittura dello scout: se la tabella non è ancora
 * stata creata su Supabase risponde con un messaggio chiaro invece di un errore
 * generico (vedi isScoutTableMissing).
 */
export async function withScoutStore<T>(run: () => Promise<T>): Promise<T | NextResponse> {
  try {
    return await run();
  } catch (error) {
    if (!isScoutTableMissing(error)) throw error;
    return NextResponse.json(
      { error: "La tabella dello scout non è ancora stata creata su Supabase: va eseguito l'aggiornamento del database." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export type ScoutPermission = { ok: true; session: SessionPayload } | { ok: false; response: NextResponse };

/**
 * Solo il permesso «Scout», senza una partita: per ciò che non riguarda una
 * partita in particolare (il manuale d'uso in PDF). Stesso controllo di
 * requireScoutAccess, con uno stato HTTP al posto del redirect.
 */
export async function requireScoutPermission(): Promise<ScoutPermission> {
  const session = await getSession();
  if (!session) return { ok: false, response: NextResponse.json({ error: "Sessione scaduta: accedi di nuovo." }, { status: 401 }) };
  if (session.role !== "dev") {
    const staff = await getOwnStaff(session.sub);
    if (!staff || !staff.allowedPages.includes("scout")) {
      return { ok: false, response: NextResponse.json({ error: "Non hai accesso allo Scout." }, { status: 403 }) };
    }
  }
  return { ok: true, session };
}
