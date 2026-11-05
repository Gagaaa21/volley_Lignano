"use server";

import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import { getActiveRepo } from "@/lib/db";
import type { Repo } from "@/lib/db/repo";
import { canUseTeam, requireStaffPage, resolveActiveTeam } from "@/lib/auth/guard";
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

/**
 * Salva un registro presenze, per U14/U15 e per il Minivolley: cambia solo come si leggono le voci dal modulo (`readRecords`).
 * Si tengono solo le atlete della squadra del registro: un modulo rimasto aperto (atleta spostata o tolta) o una richiesta
 * fatta a mano non può mettere nel registro atlete di un'altra squadra. Un errore (es. Supabase lento) non fa perdere le
 * spunte: si torna al modulo con un messaggio invece di lasciar risalire l'eccezione.
 */
async function saveAttendance(
  formData: FormData,
  readRecords: (athleteIds: string[]) => Record<string, AttendanceStatus>,
  where: string,
): Promise<{ error: string } | undefined> {
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

  try {
    const repo = await getActiveRepo();
    const { existing, team } = await resolveExistingAndTeam(repo, session, sessionId, trainingRuleId, sessionDate);
    if (!(await canUseTeam(session, team))) return { error: "Non puoi registrare le presenze di questa squadra." };
    const ofTeam = new Set((await repo.listAthletes({ team })).map((athlete) => athlete.id));
    const records = readRecords(athleteIds.filter((id) => ofTeam.has(id)));

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
    // Solo il sito pubblico della squadra toccata: i due siti sono indipendenti.
    revalidatePath(team === "minivolley" ? "/minivolley" : "/");
    if (team === "minivolley") revalidatePath("/minivolley/presenze");
    updateTag(PUBLIC_CALENDAR_TAG);
  } catch (err) {
    console.error(`[${where}]`, err);
    return { error: "Non è stato possibile salvare le presenze. Riprova." };
  }

  redirect("/admin/presenze/storico");
}

export async function saveAttendanceAction(
  _prevState: AttendanceFormState,
  formData: FormData,
): Promise<AttendanceFormState> {
  const result = await saveAttendance(
    formData,
    (ids) => Object.fromEntries(ids.map((id) => [id, normalizeStatus(formData.get(`status_${id}`)?.toString())])),
    "saveAttendanceAction",
  );
  return result ?? {};
}

export interface MiniAttendanceFormState {
  error?: string;
}

/** Registro presenze del Minivolley: stessa anagrafica di U14/U15 (vedi MiniAttendanceForm), ma un elenco con spunte senza
 * assenze — si tocca solo chi era presente. Stesso modello dati di saveAttendanceAction: la chiave di ogni voce è l'id
 * dell'atleta selezionata e vale sempre "present"; nessuna voce per chi non è stata selezionata (vedi
 * getPublicAttendanceTally). */
export async function saveMiniAttendanceAction(
  _prevState: MiniAttendanceFormState,
  formData: FormData,
): Promise<MiniAttendanceFormState> {
  const result = await saveAttendance(
    formData,
    (ids) => Object.fromEntries(ids.filter((id) => formData.get(`present_${id}`) === "on").map((id) => [id, "present" as const])),
    "saveMiniAttendanceAction",
  );
  return result ?? {};
}

export async function deleteAttendanceSessionAction(formData: FormData): Promise<void> {
  const session = await requireStaffPage("presenze");
  const id = formData.get("id")?.toString();
  if (!id) return;
  const repo = await getActiveRepo();
  const attendanceSession = await repo.getAttendanceSession(id);
  if (!attendanceSession || !(await canUseTeam(session, attendanceSession.team))) return;
  await repo.deleteAttendanceSession(id);
  revalidatePath("/admin/presenze");
  revalidatePath("/admin/presenze/storico");
  revalidatePath(attendanceSession?.team === "minivolley" ? "/minivolley" : "/");
  updateTag(PUBLIC_CALENDAR_TAG);
  redirect("/admin/presenze/storico");
}
