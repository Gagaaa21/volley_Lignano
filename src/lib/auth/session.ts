import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { StaffRole, TrainingTeam } from "@/lib/types";

export const SESSION_COOKIE = "volley_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 14; // 14 days

export interface SessionPayload {
  sub: string; // staff id
  username: string;
  fullName: string;
  role: StaffRole;
  mustChangePassword: boolean;
  /** Modalità prova (solo dev): le modifiche vanno su un archivio separato
   * e scompaiono all'uscita. Assente/false per ogni sessione normale. */
  testMode?: boolean;
  /** Squadra attiva nell'area riservata (switcher nell'header): scopa
   * Allenamenti, Partite, Schede e Presenze per tutta la sessione. Assente =
   * "u14u15" (vedi activeTeam() in guard.ts, mai letto direttamente). */
  activeTeam?: TrainingTeam;
}

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET non impostata: obbligatoria in produzione.");
    }
    // Dev-only fallback so `npm run dev` works without extra setup.
    // Sessions simply won't survive a server restart.
    return new TextEncoder().encode("dev-only-insecure-secret-change-me");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await createSessionToken(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Cookie non httpOnly che rispecchia session.activeTeam, leggibile da
 * PwaClient (componente client) per sapere a quale squadra associare
 * un'iscrizione alle notifiche push aperta dall'area riservata — senza,
 * PwaClient non ha modo di conoscere lo switcher squadra (che vive nel
 * cookie di sessione httpOnly) e taggerebbe sempre "u14u15", anche mentre si
 * lavora sul Minivolley. Non è un dato sensibile: indica solo una
 * preferenza di interfaccia, mai usato per autorizzare nulla. */
export const ACTIVE_TEAM_COOKIE = "volley_active_team";

export async function setActiveTeamCookie(team: TrainingTeam): Promise<void> {
  const store = await cookies();
  store.set(ACTIVE_TEAM_COOKIE, team, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function clearActiveTeamCookie(): Promise<void> {
  const store = await cookies();
  store.delete(ACTIVE_TEAM_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
