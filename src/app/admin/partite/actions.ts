"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { updateTag } from "next/cache";
import { z } from "zod";
import { getActiveRepo } from "@/lib/db";
import { requireStaff } from "@/lib/auth/guard";
import { notifyCalendarChange } from "@/lib/push";
import { CATEGORY_LABELS } from "@/lib/category";
import { formatDateLong } from "@/lib/format";
import { PUBLIC_CALENDAR_TAG } from "@/lib/publicCalendarData";
import type { MatchInput, MatchLineupInput } from "@/lib/types";

const setsSchema = z
  .union([z.literal(""), z.enum(["0", "1", "2", "3"])])
  .optional()
  .transform((v) => (v ? Number(v) : null));

const schema = z
  .object({
    category: z.enum(["U14", "U15"], { message: "Seleziona una categoria." }),
    opponent: z.string().min(1, "Inserisci il nome della squadra avversaria."),
    isHome: z.boolean(),
    isFriendly: z.boolean(),
    location: z.string().min(1, "Inserisci il luogo della partita."),
    matchDate: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Inserisci data e ora della partita."),
    meetingTime: z
      .union([z.literal(""), z.string().regex(/^\d{2}:\d{2}$/)])
      .optional()
      .transform((v) => v || null),
    meetingLocation: z.string().optional(),
    notes: z.string().optional(),
    calledUpAthleteIds: z.array(z.string()),
    resultSetsWon: setsSchema,
    resultSetsLost: setsSchema,
  })
  .refine((data) => (data.resultSetsWon === null) === (data.resultSetsLost === null), {
    message: "Inserisci entrambi i set del risultato (vinti e persi).",
    path: ["resultSetsLost"],
  })
  .refine(
    (data) => {
      if (data.resultSetsWon === null || data.resultSetsLost === null) return true;
      const max = Math.max(data.resultSetsWon, data.resultSetsLost);
      const min = Math.min(data.resultSetsWon, data.resultSetsLost);
      return max === 3 && min < 3;
    },
    { message: "Risultato non valido: una squadra deve arrivare a 3 set.", path: ["resultSetsWon"] },
  )
  .refine(
    (data) => {
      if (data.resultSetsWon === null || data.resultSetsLost === null) return true;
      // Confronto solo sulla data (non sull'ora, per evitare falsi negativi
      // dovuti al fuso orario tra client e server) — chi inserisce un
      // risultato lo fa comunque a partita già conclusa da un pezzo.
      const todayStr = new Date().toISOString().slice(0, 10);
      return data.matchDate.slice(0, 10) <= todayStr;
    },
    { message: "Puoi inserire il risultato solo dopo che la partita è stata giocata.", path: ["resultSetsWon"] },
  );

export interface MatchFormState {
  error?: string;
}

function matchScheduleLabel(matchDate: string, location: string): string {
  const date = matchDate.slice(0, 10);
  const time = matchDate.slice(11, 16);
  return `${formatDateLong(date)}, ${time} · ${location}`;
}

function parseMatchForm(formData: FormData) {
  return schema.safeParse({
    category: formData.get("category")?.toString(),
    opponent: formData.get("opponent")?.toString().trim() ?? "",
    isHome: formData.get("isHome") === "home",
    isFriendly: formData.get("isFriendly") === "on",
    location: formData.get("location")?.toString().trim() ?? "",
    matchDate: formData.get("matchDate")?.toString() ?? "",
    meetingTime: formData.get("meetingTime")?.toString() ?? "",
    meetingLocation: formData.get("meetingLocation")?.toString().trim() || undefined,
    notes: formData.get("notes")?.toString().trim() || undefined,
    calledUpAthleteIds: formData.getAll("calledUpAthleteIds").map((v) => v.toString()),
    resultSetsWon: formData.get("resultSetsWon")?.toString() ?? "",
    resultSetsLost: formData.get("resultSetsLost")?.toString() ?? "",
  });
}

export async function saveMatchAction(
  _prevState: MatchFormState,
  formData: FormData,
): Promise<MatchFormState> {
  const session = await requireStaff();
  const parsed = parseMatchForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
  }

  const id = formData.get("id")?.toString();
  const input: MatchInput = {
    category: parsed.data.category,
    opponent: parsed.data.opponent,
    isHome: parsed.data.isHome,
    isFriendly: parsed.data.isFriendly,
    location: parsed.data.location,
    matchDate: parsed.data.matchDate,
    meetingTime: parsed.data.meetingTime,
    meetingLocation: parsed.data.meetingLocation ?? null,
    notes: parsed.data.notes ?? null,
    calledUpAthleteIds: parsed.data.calledUpAthleteIds,
    resultSetsWon: parsed.data.resultSetsWon,
    resultSetsLost: parsed.data.resultSetsLost,
  };

  const repo = await getActiveRepo();
  const matchup = `${input.isFriendly ? "Amichevole " : ""}${CATEGORY_LABELS[input.category]} ${input.isHome ? "vs" : "@"} ${input.opponent}`;
  const scheduleLabel = matchScheduleLabel(input.matchDate, input.location);
  if (id) {
    await repo.updateMatch(id, input);
    const resultLabel =
      input.resultSetsWon !== null && input.resultSetsLost !== null
        ? ` · Risultato ${input.resultSetsWon}-${input.resultSetsLost}`
        : "";
    await notifyCalendarChange({
      title: "Partita modificata",
      body: `${matchup} · ${scheduleLabel}${resultLabel}`,
      url: "/",
    });
  } else {
    await repo.createMatch(input, session.sub);
    await notifyCalendarChange({
      title: "Partita creata",
      body: `${matchup} · ${scheduleLabel}`,
      url: "/",
    });
  }

  revalidatePath("/admin/partite");
  revalidatePath("/");
  updateTag(PUBLIC_CALENDAR_TAG);
  redirect("/admin/partite");
}

export async function deleteMatchAction(formData: FormData): Promise<void> {
  await requireStaff();
  const id = formData.get("id")?.toString();
  if (!id) return;
  const repo = await getActiveRepo();
  const match = await repo.getMatch(id);
  await repo.deleteMatch(id);
  if (match) {
    const matchup = `${CATEGORY_LABELS[match.category]} ${match.isHome ? "vs" : "@"} ${match.opponent}`;
    await notifyCalendarChange({
      title: "Partita eliminata",
      body: `${matchup} · ${matchScheduleLabel(match.matchDate, match.location)} · non è più in calendario.`,
      url: "/",
    });
  }
  revalidatePath("/admin/partite");
  revalidatePath("/");
  updateTag(PUBLIC_CALENDAR_TAG);
}

const positionSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);

const lineupSlotSchema = z.object({
  position: positionSchema,
  athleteId: z.string().nullable(),
  role: z.enum(["S", "OH", "MB", "OP", "L"]).nullable(),
  isCaptain: z.boolean(),
});

const lineupSchema = z.object({
  sets: z.array(z.array(lineupSlotSchema).length(6)).length(5),
});

/** Al massimo una capitana per set: tiene solo la prima trovata. */
function normalizeSets(sets: MatchLineupInput["sets"]): MatchLineupInput["sets"] {
  return sets.map((set) => {
    let captainFound = false;
    return set.map((slot) => {
      if (!slot.isCaptain) return slot;
      if (captainFound) return { ...slot, isCaptain: false };
      captainFound = true;
      return slot;
    });
  });
}

export interface LineupFormState {
  error?: string;
  success?: boolean;
}

export async function saveMatchLineupAction(
  _prevState: LineupFormState,
  formData: FormData,
): Promise<LineupFormState> {
  const session = await requireStaff();
  const matchId = formData.get("matchId")?.toString();
  if (!matchId) return { error: "Partita non valida." };

  let rawSets: unknown;
  try {
    rawSets = JSON.parse(formData.get("sets")?.toString() ?? "[]");
  } catch {
    return { error: "Dati non validi." };
  }

  const parsed = lineupSchema.safeParse({ sets: rawSets });
  if (!parsed.success) {
    return { error: "Dati non validi." };
  }

  const repo = await getActiveRepo();
  await repo.saveMatchLineup(matchId, { sets: normalizeSets(parsed.data.sets) }, session.sub);
  revalidatePath(`/admin/partite/${matchId}`);
  return { success: true };
}
