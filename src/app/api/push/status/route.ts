import { NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import type { TrainingTeam } from "@/lib/types";

/**
 * Come il sito ha registrato certe iscrizioni alle notifiche: per ogni indirizzo la squadra, o null se il sito non lo
 * conosce. Lo usa la pagina «Notifiche» per accorgersi di un'iscrizione registrata con la squadra sbagliata. Un indirizzo di
 * iscrizione è segreto (chi lo conosce è il dispositivo stesso): si risponde solo per quelli ricevuti, e solo con la squadra.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { endpoints?: unknown } | null;
  const endpoints = Array.isArray(body?.endpoints)
    ? body.endpoints.filter((endpoint): endpoint is string => typeof endpoint === "string" && endpoint.length > 0 && endpoint.length <= 2000)
    : [];
  if (endpoints.length === 0 || endpoints.length > 10) {
    return NextResponse.json({ error: "Indirizzi non validi." }, { status: 400 });
  }

  const known = new Map((await (await getRepo()).listPushSubscriptions()).map((sub) => [sub.endpoint, sub.team] as const));
  const teams: Record<string, TrainingTeam | null> = {};
  for (const endpoint of endpoints) teams[endpoint] = known.get(endpoint) ?? null;
  return NextResponse.json({ teams });
}
