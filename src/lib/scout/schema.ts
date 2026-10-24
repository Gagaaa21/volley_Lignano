import { z } from "zod";
import { readLevel } from "./levels";
import { SCOUT_GRADES, SCOUT_HOWS, SCOUT_LEVELS, SCOUT_TOUCH_SKILLS, type ScoutData } from "./types";

/**
 * Forma valida di uno scout salvato (src/app/api/scout). I limiti sono larghi
 * rispetto a una partita vera (al massimo 5 set da 25-30 punti: qualche
 * centinaio di scambi, ognuno con una decina di tocchi negli scout del vecchio
 * livello Completo) ma impediscono che una richiesta sbagliata riempia il database.
 */

const sideSchema = z.enum(["us", "opp"]);

const playerSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().max(60),
  number: z
    .string()
    .regex(/^\d{1,2}$/)
    .nullable(),
  libero: z.boolean(),
});

const rallySchema = z.object({
  type: z.literal("rally"),
  id: z.string().min(1).max(64),
  at: z.number().int().min(0),
  actor: sideSchema,
  how: z.enum(SCOUT_HOWS),
  player: z.string().min(1).max(64).nullable(),
  victim: z.string().min(1).max(64).nullable(),
});

const touchSchema = z.object({
  type: z.literal("touch"),
  id: z.string().min(1).max(64),
  at: z.number().int().min(0),
  side: sideSchema,
  skill: z.enum(SCOUT_TOUCH_SKILLS),
  player: z.string().min(1).max(64).nullable(),
  grade: z.enum(SCOUT_GRADES),
  zone: z.number().int().min(1).max(6).nullable(),
});

const setEndSchema = z.object({
  type: z.literal("setEnd"),
  id: z.string().min(1).max(64),
  at: z.number().int().min(0),
  nextServer: sideSchema,
});

const idOrNull = z.string().min(1).max(64).nullable();

const lineupSchema = z.object({
  type: z.literal("lineup"),
  id: z.string().min(1).max(64),
  at: z.number().int().min(0),
  side: sideSchema,
  positions: z.array(idOrNull).length(6),
  libero: idOrNull,
  hosts: z.tuple([idOrNull, idOrNull]),
});

const subSchema = z.object({
  type: z.literal("sub"),
  id: z.string().min(1).max(64),
  at: z.number().int().min(0),
  side: sideSchema,
  position: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
  player: z.string().min(1).max(64),
});

const timeoutSchema = z.object({
  type: z.literal("timeout"),
  id: z.string().min(1).max(64),
  at: z.number().int().min(0),
  side: sideSchema,
});

const rotateSchema = z.object({
  type: z.literal("rotate"),
  id: z.string().min(1).max(64),
  at: z.number().int().min(0),
  side: sideSchema,
  // Da −5 a 5, mai 0: una correzione che non cambia niente non ha senso e riempirebbe il registro.
  steps: z
    .number()
    .int()
    .min(-5)
    .max(5)
    .refine((steps) => steps !== 0, { message: "Nessuna rotazione da correggere." }),
});

function uniqueIds(items: { id: string }[]): boolean {
  return new Set(items.map((i) => i.id)).size === items.length;
}

export const MAX_SCOUT_EVENTS = 6000;
/** Giocatrici per squadra a referto: molte più di quante ne servano, per non rifiutare mai una partita vera. */
export const MAX_SCOUT_PLAYERS = 60;

export const scoutDataSchema = z
  .object({
    settings: z.object({
      format: z.enum(["bo5", "bo3", "fixed3"]),
      setPoints: z.number().int().min(10).max(50),
      lastSetPoints: z.number().int().min(10).max(50),
      firstServer: sideSchema,
      // Gli scout salvati prima del punteggio live non lo hanno: si leggono come spento.
      publicLive: z.boolean().default(false),
      // Gli scout salvati prima dei livelli non lo hanno: si leggono come «base». Quelli del vecchio livello «Completo» come «ricezioni».
      level: z.enum([...SCOUT_LEVELS, "completo"]).transform(readLevel).default("base"),
    }),
    roster: z.object({
      // Larghi: una rosa o un elenco di maglie avversarie più lungo di 30 non deve far rifiutare il salvataggio di una partita intera.
      us: z.array(playerSchema).max(MAX_SCOUT_PLAYERS).refine(uniqueIds, { message: "Giocatrici duplicate." }),
      opp: z.array(playerSchema).max(MAX_SCOUT_PLAYERS).refine(uniqueIds, { message: "Giocatrici duplicate." }),
    }),
    events: z
      .array(z.discriminatedUnion("type", [rallySchema, setEndSchema, touchSchema, lineupSchema, subSchema, timeoutSchema, rotateSchema]))
      .max(MAX_SCOUT_EVENTS),
    finished: z.boolean(),
  })
  .refine((data) => uniqueIds(data.events), { message: "Eventi duplicati." }) satisfies z.ZodType<ScoutData>;
