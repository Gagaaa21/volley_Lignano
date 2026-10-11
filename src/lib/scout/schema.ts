import { z } from "zod";
import { SCOUT_HOWS, type ScoutData } from "./types";

/**
 * Forma valida di uno scout salvato (src/app/api/scout). I limiti sono larghi
 * rispetto a una partita vera (al massimo 5 set da 25-30 punti: qualche
 * centinaio di scambi) ma impediscono che una richiesta sbagliata riempia il
 * database.
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

const setEndSchema = z.object({
  type: z.literal("setEnd"),
  id: z.string().min(1).max(64),
  at: z.number().int().min(0),
  nextServer: sideSchema,
});

function uniqueIds(items: { id: string }[]): boolean {
  return new Set(items.map((i) => i.id)).size === items.length;
}

export const MAX_SCOUT_EVENTS = 1500;

export const scoutDataSchema = z
  .object({
    settings: z.object({
      format: z.enum(["bo5", "bo3", "fixed3"]),
      setPoints: z.number().int().min(10).max(50),
      lastSetPoints: z.number().int().min(10).max(50),
      firstServer: sideSchema,
      // Gli scout salvati prima del punteggio live non lo hanno: si leggono come spento.
      publicLive: z.boolean().default(false),
    }),
    roster: z.object({
      us: z.array(playerSchema).max(30).refine(uniqueIds, { message: "Giocatrici duplicate." }),
      opp: z.array(playerSchema).max(30).refine(uniqueIds, { message: "Giocatrici duplicate." }),
    }),
    events: z.array(z.discriminatedUnion("type", [rallySchema, setEndSchema])).max(MAX_SCOUT_EVENTS),
    finished: z.boolean(),
  })
  .refine((data) => uniqueIds(data.events), { message: "Eventi duplicati." }) satisfies z.ZodType<ScoutData>;
