import { NextResponse } from "next/server";
import { ACTIVE_TEAM_COOKIE, SESSION_COOKIE } from "@/lib/auth/session";

/**
 * Esce e torna all'accesso. Ci si arriva quando una sessione non vale più (account tolto, o password rimessa dal Developer
 * dopo quell'accesso: vedi requireStaff): una pagina non può cancellare i cookie da sola, questa sì. Senza la sessione,
 * /login non rimanda più all'area riservata.
 */
export function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/login?sessione=scaduta", request.url));
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(ACTIVE_TEAM_COOKIE);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
