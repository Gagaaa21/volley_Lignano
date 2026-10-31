import { z } from "zod";
import type { Repo } from "@/lib/db/repo";
import { LIVE_SCORE_TTL_MS, type Match, type PublicLiveScore } from "@/lib/types";
import { toPublicScoutScore } from "./publicScore";
import type { MatchScout } from "./types";

/**
 * Copia compatta del punteggio live dello Scout: l'unica cosa che il sito pubblico legge durante una partita.
 *
 * Senza di lei, ogni lettura del punteggio scaricava da Supabase l'intera riga dello scout (tutti gli scambi e i tocchi:
 * decine o centinaia di KB) per poi tenerne tre righe. Con la diretta video il punteggio resta acceso per tutta la
 * partita, quindi a ogni salvataggio dello Scout se ne ricava la versione pubblica (un paio di KB al più: punteggio, numeri di
 * squadra, nostri cambi e formazione con i numeri di maglia, i nomi solo se accesi, vedi toPublicScoutScore) e la si tiene in
 * `app_settings`; la lettura pubblica rilegge solo quella.
 *
 * Valore salvato: `{ matchId, live }`. `live` è null quando quella partita ha spento il punteggio: serve a dire «non c'è
 * niente» senza ripiegare sulla lettura completa. Acceso ma senza ancora un punto, `live` è la partita «non iniziata»
 * (0–0, `notStarted`): la risposta pubblica la dà solo alla grafica della diretta video.
 */
export const PUBLIC_LIVE_SCOUT_KEY = "public_live_scout";

const teamSchema = z.object({
  name: z.string().max(200),
  color: z.string().max(20),
  score: z.number().int().min(0),
  sets: z.number().int().min(0),
});

const scoreSchema = z.object({ home: z.number().int().min(0), away: z.number().int().min(0) });

const recapTeamSchema = z.object({
  attack: z.number().int().min(0),
  block: z.number().int().min(0),
  ace: z.number().int().min(0),
  gifts: z.number().int().min(0),
  run: z.number().int().min(0),
  timeouts: z.number().int().min(0),
});

const statsSchema = z.object({ home: recapTeamSchema, away: recapTeamSchema });

const playerSchema = z.object({ number: z.string().max(10).nullable(), name: z.string().max(200).optional() });

const subSchema = z.object({ id: z.string().min(1).max(100), in: playerSchema, out: playerSchema, score: scoreSchema });

const lineupSchema = z.object({
  set: z.number().int().min(1).max(9),
  positions: z.array(playerSchema.nullable()).max(6),
  libero: playerSchema.nullable(),
});

const infoSchema = z.object({
  date: z.string().max(40),
  venue: z.string().max(300).nullable(),
  home: z.boolean(),
  friendly: z.boolean(),
});

export const publicLiveScoreSchema = z.object({
  team: z.enum(["u14u15", "minivolley"]),
  category: z.enum(["U14", "U15"]).nullable(),
  home: teamSchema,
  away: teamSchema,
  serving: z.enum(["home", "away"]).nullable(),
  sets: z.array(scoreSchema).max(9),
  timeouts: scoreSchema,
  finished: z.boolean(),
  updatedAt: z.string().refine((value) => Number.isFinite(Date.parse(value)), "Data non valida."),
  point: z
    .object({ side: z.enum(["home", "away"]), kind: z.enum(["set", "match"]) })
    .nullable()
    .optional(),
  notStarted: z.literal(true).optional(),
  warmupAt: z
    .string()
    .refine((value) => Number.isFinite(Date.parse(value)), "Data non valida.")
    .optional(),
  pregame: z.enum(["cover", "warmup", "officialWarmup", "protocol"]).optional(),
  recap: z
    .object({
      n: z.number().int().min(1).max(9),
      minutes: z.number().int().min(0).max(1_000).nullable(),
      home: recapTeamSchema,
      away: recapTeamSchema,
    })
    .optional(),
  setStats: statsSchema.optional(),
  matchStats: statsSchema.optional(),
  run: z.object({ side: z.enum(["home", "away"]), points: z.number().int().min(1) }).optional(),
  subs: z.array(subSchema).max(20).optional(),
  lineup: lineupSchema.optional(),
  info: infoSchema.optional(),
}) satisfies z.ZodType<PublicLiveScore>;

const storedSchema = z.object({ matchId: z.string().min(1), live: publicLiveScoreSchema.nullable() });

type Store = Pick<Repo, "getAppSetting" | "setAppSetting">;

function parseStored(raw: string | null): z.infer<typeof storedSchema> | null {
  if (!raw) return null;
  try {
    const parsed = storedSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Mette la copia compatta al posto di quella di prima: il punteggio pubblico di questo scout, o «niente» se è spento. */
export async function publishPublicScore(
  repo: Store,
  scout: MatchScout,
  match: Pick<Match, "team" | "category" | "opponent">,
): Promise<void> {
  const live = toPublicScoutScore(scout, match);
  if (live) {
    await repo.setAppSetting(PUBLIC_LIVE_SCOUT_KEY, JSON.stringify({ matchId: scout.matchId, live }));
    return;
  }
  await clearPublicScore(repo, scout.matchId);
}

/**
 * Toglie il punteggio pubblico di una partita (live spento, scout azzerato, partita cancellata). Se la copia è di
 * un'altra partita non si tocca: potrebbe essere in diretta in quel momento.
 */
export async function clearPublicScore(repo: Store, matchId: string): Promise<void> {
  const current = parseStored(await repo.getAppSetting(PUBLIC_LIVE_SCOUT_KEY));
  if (!current || current.matchId !== matchId || current.live === null) return;
  await repo.setAppSetting(PUBLIC_LIVE_SCOUT_KEY, JSON.stringify({ matchId, live: null }));
}

/**
 * Il punteggio live dello Scout letto dalla copia compatta:
 * - il punteggio, se una partita è in diretta;
 * - null se la copia dice che non c'è niente, o se è ferma da più di LIVE_SCORE_TTL_MS;
 * - undefined se la copia non c'è o non si legge (mai scritta, valore rovinato): chi legge ripiega sulla lettura completa.
 */
export async function readPublicScoutSnapshot(repo: Pick<Repo, "getAppSetting">, now = Date.now()): Promise<PublicLiveScore | null | undefined> {
  const stored = parseStored(await repo.getAppSetting(PUBLIC_LIVE_SCOUT_KEY));
  if (!stored) return undefined;
  if (!stored.live) return null;
  return now - Date.parse(stored.live.updatedAt) > LIVE_SCORE_TTL_MS ? null : stored.live;
}
