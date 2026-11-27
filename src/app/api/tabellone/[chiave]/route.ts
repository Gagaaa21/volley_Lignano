import { NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import { isBoardKey } from "@/lib/scout/boardLink";
import { BOARD_SCOUT_KEY, boardSnapshotFrom } from "@/lib/scout/boardSnapshot";

// Il punteggio appena segnato, sempre: mai una copia della rete o del browser.
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

type RouteContext = { params: Promise<{ chiave: string }> };

/**
 * Il punteggio per il tabellone della palestra (/tabellone/<chiave>, vedi src/lib/scout/boardLink.ts e boardSnapshot.ts): senza
 * accesso ma solo con la chiave del link, anche con la diretta spenta. Una lettura sola di app_settings (pochi byte), che il
 * tablet ripete ogni secondo mentre si gioca. Chiave sbagliata: 404, come se non ci fosse niente. Legge sempre l'archivio vero.
 */
export async function GET(_request: Request, { params }: RouteContext) {
  const { chiave } = await params;
  try {
    if (!isBoardKey(chiave)) return NextResponse.json({ error: "Link non valido." }, { status: 404, headers: NO_STORE });
    const raw = await (await getRepo()).getAppSetting(BOARD_SCOUT_KEY);
    return NextResponse.json({ live: boardSnapshotFrom(raw) }, { headers: NO_STORE });
  } catch (error) {
    console.error("[tabellone] punteggio non leggibile:", error);
    return NextResponse.json({ error: "Punteggio non disponibile." }, { status: 503, headers: NO_STORE });
  }
}
