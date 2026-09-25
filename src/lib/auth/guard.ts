import "server-only";
import { redirect } from "next/navigation";
import { getActiveRepo } from "@/lib/db";
import { getSession, type SessionPayload } from "@/lib/auth/session";
import { TEAMS, type AdminPage, type TrainingTeam } from "@/lib/types";

export async function requireStaff(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireDev(): Promise<SessionPayload> {
  const session = await requireStaff();
  if (session.role !== "dev") redirect("/admin");
  return session;
}

/**
 * Come requireStaff(), ma per una sezione specifica dell'area riservata: un
 * Developer vede sempre tutto, un Admin solo le pagine che gli sono state
 * assegnate dal Centro di controllo. Legge sempre lo stato più recente da
 * repo (mai dalla sessione JWT, valida fino a 14 giorni) così una modifica
 * ai permessi ha effetto immediato, senza dover attendere un nuovo login.
 */
export async function requireStaffPage(page: AdminPage): Promise<SessionPayload> {
  const session = await requireStaff();
  if (session.role === "dev") return session;

  const repo = await getActiveRepo();
  const staff = await repo.getStaffById(session.sub);
  if (!staff || !staff.allowedPages.includes(page)) redirect("/admin");

  return session;
}

/** Squadra attiva nella sessione (switcher nell'header): default "u14u15"
 * quando assente (login precedenti a questa funzione, o sessione appena
 * creata). Unico punto che legge session.activeTeam, per tenere lo stesso
 * default ovunque nell'area riservata. */
export function activeTeam(session: SessionPayload): TrainingTeam {
  return session.activeTeam ?? "u14u15";
}

/** Come activeTeam(), ma convalidata contro le squadre che l'account può
 * gestire (staff.allowedTeams): se la squadra scelta nello switcher non è
 * (più) permessa — es. il Developer ha appena tolto l'accesso al
 * Minivolley a questo Admin, ma il cookie di sessione (valido fino a 14
 * giorni) la ricorda ancora — ricade sulla prima squadra ancora permessa
 * invece di restituire dati non autorizzati. Un Developer non è mai
 * limitato. Legge sempre lo stato più recente da repo, come
 * requireStaffPage(), così una modifica ai permessi ha effetto immediato. */
export async function resolveActiveTeam(session: SessionPayload): Promise<TrainingTeam> {
  const requested = activeTeam(session);
  if (session.role === "dev") return requested;

  const repo = await getActiveRepo();
  const staff = await repo.getStaffById(session.sub);
  const allowed = staff?.allowedTeams ?? TEAMS;
  return allowed.includes(requested) ? requested : (allowed[0] ?? "u14u15");
}
