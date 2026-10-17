import { NextResponse } from "next/server";
import { z } from "zod";
import { requireScoutAccess, withScoutStore } from "@/lib/scout/access";
import { scoutDataSchema } from "@/lib/scout/schema";

/**
 * Scout di una partita (src/lib/scout). GET lo legge, PUT lo salva dichiarando
 * su quale versione si basa (409 con la versione attuale se nel frattempo ne è
 * stata salvata un'altra), DELETE lo azzera. Sempre no-store: lo usa chi segna
 * i punti in diretta.
 */
const NO_STORE = { "Cache-Control": "no-store" };

const putSchema = z.object({
  data: scoutDataSchema,
  baseVersion: z.number().int().min(1).nullable(),
});

type RouteContext = { params: Promise<{ matchId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { matchId } = await params;
  const access = await requireScoutAccess(matchId);
  if (!access.ok) return access.response;

  const scout = await withScoutStore(() => access.repo.getMatchScout(matchId));
  if (scout instanceof NextResponse) return scout;
  return NextResponse.json({ scout }, { headers: NO_STORE });
}

export async function PUT(request: Request, { params }: RouteContext) {
  const { matchId } = await params;
  const access = await requireScoutAccess(matchId);
  if (!access.ok) return access.response;

  const body = await request.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    // Un rifiuto non deve restare un mistero: il motivo (dove e perché) va nei log del server e arriva alla pagina.
    const reasons = parsed.error.issues.slice(0, 3).map((issue) => `${issue.path.join(".") || "richiesta"}: ${issue.message}`);
    console.error(`[scout PUT ${matchId}] dati rifiutati:`, reasons.join(" | "));
    return NextResponse.json(
      { error: `Il server non accetta questi dati (${reasons.join("; ")}). I punti restano su questo dispositivo: scarica una copia.` },
      { status: 400, headers: NO_STORE },
    );
  }

  const result = await withScoutStore(() =>
    access.repo.saveMatchScout(matchId, parsed.data.data, access.session.sub, parsed.data.baseVersion),
  );
  if (result instanceof NextResponse) return result;
  if (!result.ok) {
    return NextResponse.json(
      { error: "Questa partita è stata modificata da un altro dispositivo.", current: result.current },
      { status: 409, headers: NO_STORE },
    );
  }
  return NextResponse.json({ version: result.scout.version, updatedAt: result.scout.updatedAt }, { headers: NO_STORE });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { matchId } = await params;
  const access = await requireScoutAccess(matchId);
  if (!access.ok) return access.response;

  const done = await withScoutStore(() => access.repo.deleteMatchScout(matchId));
  if (done instanceof NextResponse) return done;
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
