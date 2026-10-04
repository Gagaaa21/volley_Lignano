import { timingSafeEqual } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import { AUTO_REFRESH_MIN_INTERVAL_MS, refreshFederation } from "@/lib/federation/refresh";
import { PUBLIC_CALENDAR_TAG } from "@/lib/publicCalendarData";

// Lettura di due gironi con qualche tentativo ciascuno: più del minimo di default.
export const maxDuration = 60;

function isAuthorized(request: Request, secret: string): boolean {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Aggiornamento di classifiche e risultati dalla federazione, richiamato dal
 * cron di Vercel (vercel.json), che invia `Authorization: Bearer
 * $CRON_SECRET`. Senza CRON_SECRET configurata la route è chiusa a tutti:
 * nessuno può farla partire dall'esterno.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET non configurata." }, { status: 503 });
  }
  if (!isAuthorized(request, secret)) {
    return NextResponse.json({ error: "Non autorizzato." }, { status: 401 });
  }

  const outcomes = await refreshFederation(await getRepo(), { minIntervalMs: AUTO_REFRESH_MIN_INTERVAL_MS });

  if (outcomes.some((outcome) => outcome.status === "updated")) {
    revalidateTag(PUBLIC_CALENDAR_TAG, "max");
    revalidatePath("/");
    revalidatePath("/admin/partite");
  }
  return NextResponse.json({ outcomes });
}
