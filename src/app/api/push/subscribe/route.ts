import { NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

interface SubscribeBody {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as SubscribeBody | null;
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;

  if (typeof endpoint !== "string" || typeof p256dh !== "string" || typeof auth !== "string") {
    return NextResponse.json({ error: "Dati di iscrizione non validi." }, { status: 400 });
  }

  const session = await getSession();
  const repo = await getRepo();
  await repo.upsertPushSubscription({ endpoint, p256dh, auth, staffId: session?.sub ?? null });
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
