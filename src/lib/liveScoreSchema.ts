import { z } from "zod";
import type { LiveScoreState } from "@/lib/types";

/**
 * Forma valida del tabellone live salvato (src/app/api/livescore). I campi
 * aggiunti dopo la prima versione hanno un valore di partenza, così una
 * partita salvata prima continua a ricaricarsi: 6 contro 6, con formazione e
 * libero come allora, senza diretta pubblica.
 */
const teamStateSchema = z.object({
  label: z.string().max(80),
  positions: z.array(z.string().max(60)).min(2).max(6),
  liberoName: z.string().max(60),
  hostNames: z.tuple([z.string(), z.string()]),
  liberoActiveFor: z.string().nullable(),
  score: z.number().int().min(0),
  setsWon: z.number().int().min(0),
  timeoutsUsed: z.number().int().min(0),
  substitutionsUsed: z.number().int().min(0).default(0),
});

const substitutionSchema = z.object({
  team: z.enum(["A", "B"]),
  set: z.number().int().min(1),
  position: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
  out: z.string().max(60),
  in: z.string().max(60),
});

const setResultSchema = z.object({
  scoreA: z.number().int().min(0),
  scoreB: z.number().int().min(0),
});

export const liveScoreStateSchema = z
  .object({
    started: z.boolean(),
    mode: z.enum(["training", "match"]),
    servingTeam: z.enum(["A", "B"]).nullable(),
    sidesSwapped: z.boolean(),
    teamA: teamStateSchema,
    teamB: teamStateSchema,
    setHistory: z.array(setResultSchema),
    opponentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    playersPerSide: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]).default(6),
    withLineup: z.boolean().default(true),
    useLibero: z.boolean().default(true),
    publicLive: z.boolean().default(false),
    team: z.enum(["u14u15", "minivolley"]).default("u14u15"),
    matchId: z.string().nullable().default(null),
    category: z.enum(["U14", "U15"]).nullable().default(null),
    substitutions: z.array(substitutionSchema).max(300).default([]),
  })
  .refine(
    (s) => s.teamA.positions.length === s.playersPerSide && s.teamB.positions.length === s.playersPerSide,
    { message: "La formazione non corrisponde al numero di giocatrici." },
  ) satisfies z.ZodType<LiveScoreState>;
