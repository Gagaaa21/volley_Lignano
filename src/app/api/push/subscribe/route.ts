import { NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { planSubscription } from "@/lib/pushSubscribe";
import type { TrainingTeam } from "@/lib/types";

interface SubscribeBody {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
  team?: unknown;
  /** Rinnovo silenzioso di un'iscrizione già esistente: squadra e account non cambiano. */
  refresh?: unknown;
  /** Indirizzo precedente, quando il browser lo ha sostituito (pushsubscriptionchange). */
  oldEndpoint?: unknown;
  /** Area riservata: collega l'account di chi è entrato a un'iscrizione che c'è già (la squadra non cambia). */
  linkStaff?: unknown;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as SubscribeBody | null;
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;

  if (typeof endpoint !== "string" || typeof p256dh !== "string" || typeof auth !== "string") {
    return NextResponse.json({ error: "Dati di iscrizione non validi." }, { status: 400 });
  }
  // Se il client non manda "team" (es. bundle non aggiornato in cache),
  // ricade sul comportamento di sempre.
  const team: TrainingTeam = body?.team === "minivolley" ? "minivolley" : "u14u15";

  const session = await getSession();
  const repo = await getRepo();

  // La squadra di un'iscrizione che il sito conosce già non cambia mai (vedi planSubscription): U14/U15 e Minivolley sono due
  // cose distinte, e un rinnovo, l'area riservata o un'app rimasta alla versione vecchia non devono spostare nessuno.
  const plan = planSubscription(
    await repo.listPushSubscriptions(),
    {
      endpoint,
      p256dh,
      auth,
      team,
      refresh: body?.refresh === true,
      linkStaff: body?.linkStaff === true,
      oldEndpoint: typeof body?.oldEndpoint === "string" ? body.oldEndpoint : null,
    },
    session?.sub ?? null,
  );
  await repo.upsertPushSubscription(plan.upsert);
  if (plan.removeEndpoint) await repo.deletePushSubscriptionByEndpoint(plan.removeEndpoint);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => null)) as SubscribeBody | null;
  const endpoint = body?.endpoint;

  if (typeof endpoint !== "string") {
    return NextResponse.json({ error: "Dati non validi." }, { status: 400 });
  }

  const repo = await getRepo();
  await repo.deletePushSubscriptionByEndpoint(endpoint);
  return NextResponse.json({ ok: true });
}
