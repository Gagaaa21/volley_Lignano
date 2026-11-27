import type { Repo } from "@/lib/db/repo";
import { LIVE_SCORE_TTL_MS, type PublicLiveScore } from "@/lib/types";
import { toPublicScoutScore, type PublicMatch } from "./publicScore";
import { publicLiveScoreSchema } from "./publicSnapshot";
import type { MatchScout } from "./types";
import { z } from "zod";

/**
 * Copia compatta del punteggio per il tabellone della palestra (/tabellone/<chiave>): solo chi è in palestra la vede, sul
 * tablet con il link. A differenza della copia pubblica (publicSnapshot.ts) non dipende dalla diretta: c'è anche con
 * «Punteggio live» spento nello Scout, e non finisce mai sul sito pubblico (si legge solo da /api/tabellone/<chiave>, con la
 * chiave del link, vedi boardLink.ts).
 *
 * Dentro solo quello che il tabellone mostra: squadre, punti, set, chi batte, time-out, set decisivo. Nessuna giocatrice.
 * Valore salvato: `{ matchId, live }`, aggiornato a ogni salvataggio dello Scout; `live` null quando lo scout è azzerato o la
 * partita cancellata.
 */
export const BOARD_SCOUT_KEY = "board_scout";

type Store = Pick<Repo, "getAppSetting" | "setAppSetting">;

const storedSchema = z.object({ matchId: z.string().min(1), live: publicLiveScoreSchema.nullable() });

function parseStored(raw: string | null): z.infer<typeof storedSchema> | null {
  if (!raw) return null;
  try {
    const parsed = storedSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Il punteggio del tabellone da uno scout: come quello pubblico (stessi conti, stessa finestra intorno all'orario della
 * partita) ma anche con la diretta spenta, e tenendo solo squadre, punti, set, chi batte e time-out.
 */
export function toBoardScore(scout: MatchScout, match: PublicMatch): PublicLiveScore | null {
  const full = toPublicScoutScore({ ...scout, settings: { ...scout.settings, publicLive: true } }, match);
  if (!full) return null;
  return {
    team: full.team,
    category: full.category,
    home: { name: full.home.name, color: full.home.color, score: full.home.score, sets: full.home.sets },
    away: { name: full.away.name, color: full.away.color, score: full.away.score, sets: full.away.sets },
    serving: full.serving,
    sets: full.sets,
    timeouts: full.timeouts,
    finished: full.finished,
    ...(full.setRules ? { setRules: full.setRules } : {}),
    ...(full.notStarted ? { notStarted: true as const } : {}),
    updatedAt: full.updatedAt,
  };
}

/** Mette la copia del tabellone al posto di quella di prima, dopo un salvataggio dello Scout. */
export async function publishBoardScore(repo: Store, scout: MatchScout, match: PublicMatch): Promise<void> {
  const live = toBoardScore(scout, match);
  if (live) {
    await repo.setAppSetting(BOARD_SCOUT_KEY, JSON.stringify({ matchId: scout.matchId, live }));
    return;
  }
  await clearBoardScore(repo, scout.matchId);
}

/** Toglie il punteggio del tabellone di una partita (scout azzerato, partita cancellata); quello di un'altra partita resta. */
export async function clearBoardScore(repo: Store, matchId: string): Promise<void> {
  const current = parseStored(await repo.getAppSetting(BOARD_SCOUT_KEY));
  if (!current || current.matchId !== matchId || current.live === null) return;
  await repo.setAppSetting(BOARD_SCOUT_KEY, JSON.stringify({ matchId, live: null }));
}

/** Il punteggio del tabellone dal valore salvato: null se non c'è niente o se è fermo da più di LIVE_SCORE_TTL_MS. */
export function boardSnapshotFrom(raw: string | null, now = Date.now()): PublicLiveScore | null {
  const live = parseStored(raw)?.live ?? null;
  if (!live) return null;
  return now - Date.parse(live.updatedAt) > LIVE_SCORE_TTL_MS ? null : live;
}
