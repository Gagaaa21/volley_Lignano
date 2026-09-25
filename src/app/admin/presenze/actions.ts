"use server";

import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import { getActiveRepo } from "@/lib/db";
import type { Repo } from "@/lib/db/repo";
import { requireStaffPage, resolveActiveTeam } from "@/lib/auth/guard";
import { PUBLIC_CALENDAR_TAG } from "@/lib/publicCalendarData";
import type { AttendanceSession, AttendanceSessionInput, AttendanceStatus, TrainingTeam } from "@/lib/types";
import type { SessionPayload } from "@/lib/auth/session";

export interface AttendanceFormState {
  error?: string;
}

function normalizeStatus(raw: string | undefined): AttendanceStatus {
  return raw === "excused" || raw === "unexcused" ? raw : "present";
}

/** Il registro esistente per questa seduta (se già salvato) e la squadra a
 * cui appartiene: un registro esistente non cambia mai squadra in modifica;
 * uno nuovo collegato a un allenamento eredita la squadra di
 * quell'allenamento, altrimenti la squadra attiva nello switcher. Condiviso
 * da saveAttendanceAction e saveMiniAttendanceAction. */
async function resolveExistingAndTeam(
  repo: Repo,
  session: SessionPayload,
  sessionId: string | undefined,
  trainingRuleId: string | null,
  sessionDate: string,
): Promise<{ existing: AttendanceSession | null; team: TrainingTeam }> {
  const existingById = sessionId ? await repo.getAttendanceSession(sessionId) : null;
  const existingByOccurrence =
    !sessionId && trainingRuleId
      ? await repo.getAttendanceSessionByOccurrence(trainingRuleId, sessionDate)
      : null;
  const existing = existingById ?? existingByOccurrence;
  const team =
    existing?.team ??
    (trainingRuleId ? (await repo.getTraining(trainingRuleId))?.team : undefined) ??
    (await resolveActiveTeam(session));
  return { existing, team };
}

export async function saveAttendanceAction(
  _prevState: AttendanceFormState,
  formData: FormData,
): Promise<AttendanceFormState> {
  const session = await requireStaffPage("presenze");

  const sessionId = formData.get("sessionId")?.toString() || undefined;
  const trainingRuleId = formData.get("trainingRuleId")?.toString() || null;
  const sessionDate = formData.get("sessionDate")?.toString();
  const title = formData.get("title")?.toString().trim() || "Allenamento";
  const location = formData.get("location")?.toString().trim() || "";
  const athleteIds = (formData.get("athleteIds")?.toString() ?? "").split(",").filter(Boolean);

  if (!sessionDate || !/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) {
    return { error: "Data non valida." };
  }

  const records: Record<string, AttendanceStatus> = {};
  for (const athleteId of athleteIds) {
    records[athleteId] = normalizeStatus(formData.get(`status_${athleteId}`)?.toString());
  }

  // Un errore qui (es. Supabase lento/irraggiungibile) non deve far perdere
  // le presenze appena spuntate: si torna al form con un messaggio invece
  // di lasciar risalire l'eccezione (che smonterebbe il form senza un
  // error.tsx dedicato).
  try {
    const repo = await getActiveRepo();
    const { existing, team } = await resolveExistingAndTeam(repo, session, sessionId, trainingRuleId, sessionDate);

    const input: AttendanceSessionInput = { trainingRuleId, team, sessionDate, title, location, records };

    if (sessionId) {
      await repo.updateAttendanceSession(sessionId, input);
    } else if (existing) {
      await repo.updateAttendanceSession(existing.id, input);
    } else {
      await repo.createAttendanceSession(input, session.sub);
    }

    revalidatePath("/admin/presenze");
    revalidatePath("/admin/presenze/storico");
    // Solo il sito pubblico della squadra toccata: i due siti sono
    // indipendenti.
    revalidatePath(team === "minivolley" ? "/minivolley" : "/");
    updateTag(PUBLIC_CALENDAR_TAG);
  } catch (err) {
    console.error("[saveAttendanceAction]", err);
    return { error: "Non è stato possibile salvare le presenze. Riprova." };
  }

  redirect("/admin/presenze/storico");
}

export interface MiniAttendanceFormState {
  error?: string;
}

/** Registro presenze del Minivolley: niente elenco con spunte, solo un
 * elenco libero di chi era presente (vedi MiniAttendanceForm). Salva comunque
 * un AttendanceSession con lo stesso identico modello dati — solo che il
 * records contiene un'unica voce ("present") per ogni atleta presente,
 * nessuna voce per chi non lo era: le assenze non vengono tracciate, solo il
 * conteggio delle presenze (vedi getPublicAttendanceTally). */
export async function saveMiniAttendanceAction(
  _prevState: MiniAttendanceFormState,
  formData: FormData,
): Promise<MiniAttendanceFormState> {
  const session = await requireStaffPage("presenze");

  const sessionId = formData.get("sessionId")?.toString() || undefined;
  const trainingRuleId = formData.get("trainingRuleId")?.toString() || null;
  const sessionDate = formData.get("sessionDate")?.toString();
  const title = formData.get("title")?.toString().trim() || "Allenamento";
  const location = formData.get("location")?.toString().trim() || "";
  const presentAthleteIds = (formData.get("presentAthleteIds")?.toString() ?? "")
    .split(",")
    .filter(Boolean);

  if (!sessionDate || !/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) {
    return { error: "Data non valida." };
  }

  const records: Record<string, AttendanceStatus> = {};
  for (const athleteId of presentAthleteIds) records[athleteId] = "present";

  try {
    const repo = await getActiveRepo();
    const { existing, team } = await resolveExistingAndTeam(repo, session, sessionId, trainingRuleId, sessionDate);

    const input: AttendanceSessionInput = { trainingRuleId, team, sessionDate, title, location, records };

    if (sessionId) {
      await repo.updateAttendanceSession(sessionId, input);
    } else if (existing) {
      await repo.updateAttendanceSession(existing.id, input);
    } else {
      await repo.createAttendanceSession(input, session.sub);
    }

    revalidatePath("/admin/presenze");
    revalidatePath("/admin/presenze/storico");
    revalidatePath(team === "minivolley" ? "/minivolley" : "/");
    updateTag(PUBLIC_CALENDAR_TAG);
  } catch (err) {
    console.error("[saveMiniAttendanceAction]", err);
    return { error: "Non è stato possibile salvare le presenze. Riprova." };
  }

  redirect("/admin/presenze/storico");
}

export async function deleteAttendanceSessionAction(formData: FormData): Promise<void> {
  await requireStaffPage("presenze");
  const id = formData.get("id")?.toString();
  if (!id) return;
  const repo = await getActiveRepo();
  const attendanceSession = await repo.getAttendanceSession(id);
  await repo.deleteAttendanceSession(id);
  revalidatePath("/admin/presenze");
  revalidatePath("/admin/presenze/storico");
  revalidatePath(attendanceSession?.team === "minivolley" ? "/minivolley" : "/");
  updateTag(PUBLIC_CALENDAR_TAG);
}
