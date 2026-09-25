"use server";

import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import { getActiveRepo } from "@/lib/db";
import { requireStaffPage, resolveActiveTeam } from "@/lib/auth/guard";
import { PUBLIC_CALENDAR_TAG } from "@/lib/publicCalendarData";
import type { AttendanceSessionInput, AttendanceStatus } from "@/lib/types";

export interface AttendanceFormState {
  error?: string;
}

function normalizeStatus(raw: string | undefined): AttendanceStatus {
  return raw === "excused" || raw === "unexcused" ? raw : "present";
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

  const repo = await getActiveRepo();
  // La squadra di un registro esistente non cambia mai in modifica; per un
  // nuovo registro collegato a un allenamento eredita la squadra di
  // quell'allenamento, altrimenti la squadra attiva nello switcher.
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

  const input: AttendanceSessionInput = { trainingRuleId, team, sessionDate, title, location, records };

  if (sessionId) {
    await repo.updateAttendanceSession(sessionId, input);
  } else if (existingByOccurrence) {
    await repo.updateAttendanceSession(existingByOccurrence.id, input);
  } else {
    await repo.createAttendanceSession(input, session.sub);
  }

  revalidatePath("/admin/presenze");
  revalidatePath("/admin/presenze/storico");
  revalidatePath("/");
  updateTag(PUBLIC_CALENDAR_TAG);
  redirect("/admin/presenze/storico");
}

export async function deleteAttendanceSessionAction(formData: FormData): Promise<void> {
  await requireStaffPage("presenze");
  const id = formData.get("id")?.toString();
  if (!id) return;
  const repo = await getActiveRepo();
  await repo.deleteAttendanceSession(id);
  revalidatePath("/admin/presenze");
  revalidatePath("/admin/presenze/storico");
  revalidatePath("/");
  updateTag(PUBLIC_CALENDAR_TAG);
}
