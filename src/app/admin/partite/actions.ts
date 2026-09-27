"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { updateTag } from "next/cache";
import { z } from "zod";
import { getActiveRepo } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guard";
import { notifyCalendarChange } from "@/lib/push";
import { CATEGORY_LABELS, MATCH_NO_CATEGORY_LABEL } from "@/lib/category";
import { formatDateLong } from "@/lib/format";
import { PUBLIC_CALENDAR_TAG } from "@/lib/publicCalendarData";
import { parseSetScoresFromFormData, parseTournamentGamesJson } from "@/lib/setScores";
import type { MatchInput, MatchLineupInput } from "@/lib/types";

const schema = z
  .object({
    team: z.enum(["u14u15", "minivolley"]),
    // Solo per la squadra u14u15: il Minivolley non ha la distinzione U14/U15.
    category: z.union([z.enum(["U14", "U15"]), z.literal("")]).optional(),
    opponent: z.string().min(1, "Inserisci il nome della squadra avversaria."),
    isHome: z.boolean(),
    isFriendly: z.boolean(),
    isTournament: z.boolean(),
    location: z.string().min(1, "Inserisci il luogo della partita."),
    matchDate: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Inserisci data e ora della partita."),
    meetingTime: z
      .union([z.literal(""), z.string().regex(/^\d{2}:\d{2}$/)])
      .optional()
      .transform((v) => v || null),
    meetingLocation: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine((data) => data.team !== "u14u15" || data.category === "U14" || data.category === "U15", {
    message: "Seleziona una categoria.",
    path: ["category"],
  });

export interface MatchFormState {
  error?: string;
}

function matchScheduleLabel(matchDate: string, location: string): string {
  const date = matchDate.slice(0, 10);
  const time = matchDate.slice(11, 16);
  return `${formatDateLong(date)}, ${time} · ${location}`;
}

/** Riga sintetica per le notifiche push: "vs"/"@" indica casa/trasferta,
 * ma per un torneo (dove "opponent" descrive l'evento, non un'unica
 * avversaria) quella sigla non avrebbe senso — si mostra solo il testo. */
function matchupLabel(input: {
  category: "U14" | "U15" | null;
  opponent: string;
  isHome: boolean;
  isFriendly: boolean;
  isTournament: boolean;
}): string {
  const prefix = input.isFriendly ? "Amichevole " : "";
  const categoryLabel = input.category ? CATEGORY_LABELS[input.category] : MATCH_NO_CATEGORY_LABEL;
  if (input.isTournament) return `${prefix}${categoryLabel} · ${input.opponent}`;
  return `${prefix}${categoryLabel} ${input.isHome ? "vs" : "@"} ${input.opponent}`;
}

function parseMatchForm(formData: FormData) {
  return schema.safeParse({
    team: formData.get("team")?.toString() === "minivolley" ? "minivolley" : "u14u15",
    category: formData.get("category")?.toString() ?? "",
    opponent: formData.get("opponent")?.toString().trim() ?? "",
    isHome: formData.get("isHome") === "home",
    isFriendly: formData.get("isFriendly") === "on",
    isTournament: formData.get("isTournament") === "on",
    location: formData.get("location")?.toString().trim() ?? "",
    matchDate: formData.get("matchDate")?.toString() ?? "",
    meetingTime: formData.get("meetingTime")?.toString() ?? "",
    meetingLocation: formData.get("meetingLocation")?.toString().trim() || undefined,
    notes: formData.get("notes")?.toString().trim() || undefined,
  });
}

export async function saveMatchAction(
  _prevState: MatchFormState,
  formData: FormData,
): Promise<MatchFormState> {
  const session = await requireStaffPage("partite");
  const parsed = parseMatchForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
  }

  const isTournament = parsed.data.isTournament;
  // Per un torneo il risultato non è un unico setScores ma una partita per
  // ogni avversaria affrontata (tournamentGames) — i due campi sono a
  // esclusione reciproca, mai valorizzati entrambi.
  const result = isTournament ? { setScores: null, resultSetsWon: null, resultSetsLost: null } : parseSetScoresFromFormData(formData);
  if ("error" in result && result.error) {
    return { error: result.error };
  }
  const tournamentResult = isTournament
    ? parseTournamentGamesJson(formData.get("tournamentGames")?.toString() ?? "[]", { requireCompleteScore: false })
    : { tournamentGames: null };
  if ("error" in tournamentResult && tournamentResult.error) {
    return { error: tournamentResult.error };
  }

  const hasResultInput =
    result.resultSetsWon !== null || (tournamentResult.tournamentGames?.some((g) => g.setScores.length > 0) ?? false);
  if (hasResultInput) {
    // Confronto solo sulla data (non sull'ora, per evitare falsi negativi
    // dovuti al fuso orario tra client e server) — chi inserisce un
    // risultato lo fa comunque a partita già conclusa da un pezzo.
    const todayStr = new Date().toISOString().slice(0, 10);
    if (parsed.data.matchDate.slice(0, 10) > todayStr) {
      return { error: "Puoi inserire il risultato solo dopo che la partita è stata giocata." };
    }
  }

  const id = formData.get("id")?.toString();
  const notify = formData.get("notify") === "on";

  // Un errore qui (es. Supabase lento/irraggiungibile) non deve far perdere
  // quanto digitato: si torna al form con un messaggio invece di lasciar
  // risalire l'eccezione (che smonterebbe il form senza un error.tsx
  // dedicato).
  try {
    const repo = await getActiveRepo();
    // Le convocazioni si gestiscono solo dalla finestra "Convocazioni e
    // formazioni": qui si preserva il valore esistente invece di azzerarlo.
    // La squadra di una partita esistente non cambia mai in modifica (il
    // campo "team" nel form è nascosto e riflette quella già salvata).
    const existing = id ? await repo.getMatch(id) : null;
    const team = existing?.team ?? parsed.data.team;
    const input: MatchInput = {
      team,
      category: team === "u14u15" ? (parsed.data.category as "U14" | "U15") : null,
      opponent: parsed.data.opponent,
      isHome: parsed.data.isHome,
      isFriendly: parsed.data.isFriendly,
      isTournament: parsed.data.isTournament,
      location: parsed.data.location,
      matchDate: parsed.data.matchDate,
      meetingTime: parsed.data.meetingTime,
      meetingLocation: parsed.data.meetingLocation ?? null,
      notes: parsed.data.notes ?? null,
      calledUpAthleteIds: existing?.calledUpAthleteIds ?? [],
      setScores: result.setScores,
      resultSetsWon: result.resultSetsWon,
      resultSetsLost: result.resultSetsLost,
      tournamentGames: tournamentResult.tournamentGames,
    };

    const matchup = matchupLabel(input);
    const scheduleLabel = matchScheduleLabel(input.matchDate, input.location);
    if (id) {
      await repo.updateMatch(id, input);
      if (notify) {
        const resultLabel =
          input.resultSetsWon !== null && input.resultSetsLost !== null
            ? ` · Risultato ${input.resultSetsWon}-${input.resultSetsLost}`
            : "";
        await notifyCalendarChange(
          {
            title: "Partita modificata",
            body: `${matchup} · ${scheduleLabel}${resultLabel}`,
            url: team === "minivolley" ? "/minivolley" : "/",
          },
          team,
        );
      }
    } else {
      await repo.createMatch(input, session.sub);
      if (notify) {
        await notifyCalendarChange(
          {
            title: "Partita creata",
            body: `${matchup} · ${scheduleLabel}`,
            url: team === "minivolley" ? "/minivolley" : "/",
          },
          team,
        );
      }
    }

    revalidatePath("/admin/partite");
    // Solo il sito pubblico della squadra toccata: i due siti sono
    // indipendenti.
    revalidatePath(team === "minivolley" ? "/minivolley" : "/");
    updateTag(PUBLIC_CALENDAR_TAG);
  } catch (err) {
    console.error("[saveMatchAction]", err);
    return { error: "Non è stato possibile salvare la partita. Riprova." };
  }

  redirect("/admin/partite");
}

export async function deleteMatchAction(formData: FormData): Promise<void> {
  await requireStaffPage("partite");
  const id = formData.get("id")?.toString();
  if (!id) return;
  const repo = await getActiveRepo();
  const match = await repo.getMatch(id);
  await repo.deleteMatch(id);
  if (match) {
    const matchup = matchupLabel(match);
    await notifyCalendarChange(
      {
        title: "Partita eliminata",
        body: `${matchup} · ${matchScheduleLabel(match.matchDate, match.location)} · non è più in calendario.`,
        url: match.team === "minivolley" ? "/minivolley" : "/",
      },
      match.team,
    );
  }
  revalidatePath("/admin/partite");
  revalidatePath(match?.team === "minivolley" ? "/minivolley" : "/");
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

const setLineupSchema = z.object({
  slots: z.array(lineupSlotSchema).length(6),
  liberoIds: z.array(z.string().nullable()).length(2),
});

const lineupSchema = z.object({
  sets: z.array(setLineupSchema).length(5),
});

/** Al massimo una capitana per set (tiene solo la prima trovata), nessuna
 * convocata assegnata due volte nello stesso set (posizione + libero) e solo
 * atlete effettivamente convocate. */
function normalizeSets(
  sets: MatchLineupInput["sets"],
  calledUpAthleteIds: string[],
): MatchLineupInput["sets"] {
  const calledUp = new Set(calledUpAthleteIds);
  return sets.map((set) => {
    let captainFound = false;
    const assigned = new Set<string>();

    const slots = set.slots.map((slot) => {
      let next = slot;
      if (next.athleteId && !calledUp.has(next.athleteId)) {
        next = { ...next, athleteId: null, role: null, isCaptain: false };
      }
      if (next.athleteId) {
        if (assigned.has(next.athleteId)) next = { ...next, athleteId: null, role: null, isCaptain: false };
        else assigned.add(next.athleteId);
      }
      if (next.isCaptain) {
        if (captainFound) next = { ...next, isCaptain: false };
        else captainFound = true;
      }
      return next;
    });

    const liberoIds = set.liberoIds.map((athleteId) => {
      if (!athleteId || !calledUp.has(athleteId) || assigned.has(athleteId)) return null;
      assigned.add(athleteId);
      return athleteId;
    });

    return { slots, liberoIds };
  });
}

export interface CallUpsAndLineupFormState {
  error?: string;
  success?: boolean;
}

/** Salva insieme le convocazioni della partita e le formazioni per set,
 * gestite entrambe dalla finestra "Convocazioni e formazioni". */
export async function saveCallUpsAndLineupAction(
  _prevState: CallUpsAndLineupFormState,
  formData: FormData,
): Promise<CallUpsAndLineupFormState> {
  const session = await requireStaffPage("partite");
  const matchId = formData.get("matchId")?.toString();
  if (!matchId) return { error: "Partita non valida." };

  const repo = await getActiveRepo();
  const match = await repo.getMatch(matchId);
  if (!match) return { error: "Partita non trovata." };

  const calledUpAthleteIds = formData.getAll("calledUpAthleteIds").map((v) => v.toString());

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

  const input: MatchInput = {
    team: match.team,
    category: match.category,
    opponent: match.opponent,
    isHome: match.isHome,
    isFriendly: match.isFriendly,
    isTournament: match.isTournament,
    location: match.location,
    matchDate: match.matchDate,
    meetingTime: match.meetingTime,
    meetingLocation: match.meetingLocation,
    notes: match.notes,
    calledUpAthleteIds,
    setScores: match.setScores,
    resultSetsWon: match.resultSetsWon,
    resultSetsLost: match.resultSetsLost,
    tournamentGames: match.tournamentGames,
  };
  try {
    await repo.updateMatch(matchId, input);
    await repo.saveMatchLineup(
      matchId,
      { sets: normalizeSets(parsed.data.sets, calledUpAthleteIds) },
      session.sub,
    );
    revalidatePath(`/admin/partite/${matchId}`);
    // Le convocazioni sono visibili anche sul sito pubblico: invalida la
    // cache del calendario, altrimenti resterebbero non aggiornate fino a
    // 5 minuti (il tempo di validità di getPublicCalendarData). Solo il
    // sito della squadra toccata: i due siti sono indipendenti.
    revalidatePath(match.team === "minivolley" ? "/minivolley" : "/");
    updateTag(PUBLIC_CALENDAR_TAG);
  } catch (err) {
    console.error("[saveCallUpsAndLineupAction]", err);
    return { error: "Non è stato possibile salvare convocazioni e formazioni. Riprova." };
  }
  return { success: true };
}
