"use server";

import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import { getRepo } from "@/lib/db";
import { requireStaff } from "@/lib/auth/guard";
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
  const session = await requireStaff();

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

  const input: AttendanceSessionInput = { trainingRuleId, sessionDate, title, location, records };
  const repo = await getRepo();

  if (sessionId) {
    await repo.updateAttendanceSession(sessionId, input);
  } else {
    const existing = trainingRuleId
      ? await repo.getAttendanceSessionByOccurrence(trainingRuleId, sessionDate)
      : null;
    if (existing) {
      await repo.updateAttendanceSession(existing.id, input);
    } else {
      await repo.createAttendanceSession(input, session.sub);
    }
  }

  revalidatePath("/admin/presenze");
  revalidatePath("/admin/presenze/storico");
  revalidatePath("/");
  updateTag(PUBLIC_CALENDAR_TAG);
  redirect("/admin/presenze/storico");
}

export async function deleteAttendanceSessionAction(formData: FormData): Promise<void> {
  await requireStaff();
  const id = formData.get("id")?.toString();
  if (!id) return;
  const repo = await getRepo();
  await repo.deleteAttendanceSession(id);
  revalidatePath("/admin/presenze");
  revalidatePath("/admin/presenze/storico");
  revalidatePath("/");
  updateTag(PUBLIC_CALENDAR_TAG);
}
