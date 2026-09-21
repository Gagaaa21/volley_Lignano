"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRepo } from "@/lib/db";
import { requireStaff } from "@/lib/auth/guard";
import { notifyCalendarChange } from "@/lib/push";
import { CATEGORY_LABELS } from "@/lib/category";
import { formatDateLong } from "@/lib/format";
import type { MatchInput, MatchLineupInput } from "@/lib/types";

const schema = z.object({
  category: z.enum(["U14", "U15"], { message: "Seleziona una categoria." }),
  opponent: z.string().min(1, "Inserisci il nome della squadra avversaria."),
  isHome: z.boolean(),
  location: z.string().min(1, "Inserisci il luogo della partita."),
  matchDate: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Inserisci data e ora della partita."),
  notes: z.string().optional(),
  calledUpAthleteIds: z.array(z.string()),
});

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
    location: formData.get("location")?.toString().trim() ?? "",
    matchDate: formData.get("matchDate")?.toString() ?? "",
    notes: formData.get("notes")?.toString().trim() || undefined,
    calledUpAthleteIds: formData.getAll("calledUpAthleteIds").map((v) => v.toString()),
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
    location: parsed.data.location,
    matchDate: parsed.data.matchDate,
    notes: parsed.data.notes ?? null,
    calledUpAthleteIds: parsed.data.calledUpAthleteIds,
  };

  const repo = await getRepo();
  const matchup = `${CATEGORY_LABELS[input.category]} ${input.isHome ? "vs" : "@"} ${input.opponent}`;
  const scheduleLabel = matchScheduleLabel(input.matchDate, input.location);
  if (id) {
    await repo.updateMatch(id, input);
    await notifyCalendarChange({
      title: "Partita modificata",
      body: `${matchup} · ${scheduleLabel}`,
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
  redirect("/admin/partite");
}

export async function deleteMatchAction(formData: FormData): Promise<void> {
  await requireStaff();
  const id = formData.get("id")?.toString();
  if (!id) return;
  const repo = await getRepo();
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

  const repo = await getRepo();
  await repo.saveMatchLineup(matchId, { sets: normalizeSets(parsed.data.sets) }, session.sub);
  revalidatePath(`/admin/partite/${matchId}`);
  return { success: true };
}
