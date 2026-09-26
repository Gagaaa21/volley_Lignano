import { NextResponse } from "next/server";
import { z } from "zod";
import { getActiveRepo } from "@/lib/db";
import { getOwnStaff } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/session";
import type { LiveScoreState } from "@/lib/types";

const teamStateSchema = z.object({
  label: z.string(),
  positions: z.tuple([z.string(), z.string(), z.string(), z.string(), z.string(), z.string()]),
  liberoName: z.string(),
  hostNames: z.tuple([z.string(), z.string()]),
  liberoActiveFor: z.string().nullable(),
  score: z.number().int().min(0),
  setsWon: z.number().int().min(0),
  timeoutsUsed: z.number().int().min(0),
});

const setResultSchema = z.object({
  scoreA: z.number().int().min(0),
  scoreB: z.number().int().min(0),
});

const liveScoreStateSchema = z.object({
  started: z.boolean(),
  servingTeam: z.enum(["A", "B"]).nullable(),
  sidesSwapped: z.boolean(),
  teamA: teamStateSchema,
  teamB: teamStateSchema,
  setHistory: z.array(setResultSchema),
}) satisfies z.ZodType<LiveScoreState>;

/** Stesso controllo di requireStaffPage("livescore") in guard.ts, ma senza
 * redirect: una Route Handler non può reindirizzare una fetch del client,
 * deve rispondere con uno stato HTTP. */
async function requireLiveScoreAccess() {
  const session = await getSession();
  if (!session) return null;
  if (session.role === "dev") return session;
  const staff = await getOwnStaff(session.sub);
  if (!staff || !staff.allowedPages.includes("livescore")) return null;
  return session;
}

export async function GET() {
  const session = await requireLiveScoreAccess();
  if (!session) return NextResponse.json({ error: "Non autorizzato." }, { status: 401 });

  const repo = await getActiveRepo();
  const state = await repo.getLiveScoreState();
  if (!state) return NextResponse.json({ state: null });

  // Un salvataggio fatto con una versione precedente dello strumento (prima
  // che cambiasse la forma dei dati, es. l'aggiunta di hostNames/liberoActiveFor)
  // può restare valido per il TTL ma non corrispondere più a questo schema: va
  // scartato invece di essere inviato al client così com'è, altrimenti la
  // pagina va in errore leggendo campi che non esistono più.
  const parsed = liveScoreStateSchema.safeParse(state);
  if (!parsed.success) {
    await repo.clearLiveScoreState();
    return NextResponse.json({ state: null });
  }
  return NextResponse.json({ state: parsed.data });
}

export async function POST(request: Request) {
  const session = await requireLiveScoreAccess();
  if (!session) return NextResponse.json({ error: "Non autorizzato." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = liveScoreStateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi." }, { status: 400 });
  }

  const repo = await getActiveRepo();
  await repo.saveLiveScoreState(parsed.data);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await requireLiveScoreAccess();
  if (!session) return NextResponse.json({ error: "Non autorizzato." }, { status: 401 });

  const repo = await getActiveRepo();
  await repo.clearLiveScoreState();
  return NextResponse.json({ ok: true });
}
