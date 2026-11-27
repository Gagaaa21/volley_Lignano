import { NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import { requireScoutPermission } from "@/lib/scout/access";
import { BOARD_SCOUT_KEY, boardSnapshotFrom } from "@/lib/scout/boardSnapshot";

// Il punteggio appena segnato, sempre: mai una copia della rete o del browser.
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Il punteggio per il tabellone della palestra (/tabellone, vedi src/lib/scout/boardSnapshot.ts): solo con la sessione dello
 * staff e il permesso «Scout», anche con la diretta spenta. Una lettura sola di app_settings (pochi byte), che il tablet
 * ripete ogni secondo mentre si gioca. Legge sempre l'archivio vero.
 */
export async function GET() {
  const access = await requireScoutPermission();
  if (!access.ok) {
    access.response.headers.set("Cache-Control", "no-store");
    return access.response;
  }
  try {
    const raw = await (await getRepo()).getAppSetting(BOARD_SCOUT_KEY);
    return NextResponse.json({ live: boardSnapshotFrom(raw) }, { headers: NO_STORE });
  } catch (error) {
    console.error("[tabellone] punteggio non leggibile:", error);
    return NextResponse.json({ error: "Punteggio non disponibile." }, { status: 503, headers: NO_STORE });
  }
}
