"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { updateTag } from "next/cache";
import { z } from "zod";
import { getActiveRepo } from "@/lib/db";
import { requireStaff, requireStaffPage } from "@/lib/auth/guard";
import { notifyCalendarChange, notifyStaffChange } from "@/lib/push";
import { formatDateLong, formatDateShort, formatWeekdays } from "@/lib/format";
import { PUBLIC_CALENDAR_TAG } from "@/lib/publicCalendarData";
import type { TrainingRuleInput } from "@/lib/types";

const schema = z
  .object({
    title: z.string().min(1, "Inserisci un titolo."),
    location: z.string().min(1, "Inserisci il luogo."),
    repeat: z.enum(["weekly", "once"]),
    weekdays: z.array(z.number().int().min(0).max(6)),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Orario di inizio non valido."),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "Orario di fine non valido."),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida."),
    endDate: z
      .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")])
      .optional(),
    notes: z.string().optional(),
    isActive: z.boolean(),
    team: z.enum(["u14u15", "minivolley"]),
    isTournament: z.boolean(),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "L'orario di fine deve essere successivo a quello di inizio.",
    path: ["endTime"],
  })
  .refine((data) => !data.endDate || data.endDate >= data.startDate, {
    message: "La data di fine deve essere successiva alla data di inizio.",
    path: ["endDate"],
  })
  .refine((data) => data.repeat !== "weekly" || data.weekdays.length > 0, {
    message: "Seleziona almeno un giorno della settimana.",
    path: ["weekdays"],
  });

export interface TrainingFormState {
  error?: string;
}

function parseTrainingForm(formData: FormData) {
  return schema.safeParse({
    title: formData.get("title")?.toString().trim() || "Allenamento",
    location: formData.get("location")?.toString().trim() ?? "",
    repeat: formData.get("repeat")?.toString() === "once" ? "once" : "weekly",
    weekdays: formData.getAll("weekdays").map((v) => Number(v)),
    startTime: formData.get("startTime")?.toString() ?? "",
    endTime: formData.get("endTime")?.toString() ?? "",
    startDate: formData.get("startDate")?.toString() ?? "",
    endDate: formData.get("endDate")?.toString() ?? "",
    notes: formData.get("notes")?.toString().trim() || undefined,
    isActive: formData.get("isActive") === "on",
    team: formData.get("team")?.toString() === "minivolley" ? "minivolley" : "u14u15",
    isTournament: formData.get("isTournament") === "on",
  });
}

export async function saveTrainingAction(
  _prevState: TrainingFormState,
  formData: FormData,
): Promise<TrainingFormState> {
  // Il permesso dipende dalla squadra del form: si legge dal formData grezzo
  // (stessa logica di parseTrainingForm) prima ancora di validare il resto,
  // così l'accesso viene negato senza toccare il repo.
  const rawTeam = formData.get("team")?.toString() === "minivolley" ? "minivolley" : "u14u15";
  const session = await requireStaffPage(rawTeam === "minivolley" ? "minivolley" : "allenamenti");
  const parsed = parseTrainingForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
  }

  const id = formData.get("id")?.toString();
  const notify = formData.get("notify") === "on";
  // Un torneo è per natura un evento singolo: forza "once" anche se il
  // checkbox è stato spuntato senza passare dai radio Settimanale/Singolo
  // giorno (es. submit rapido), qualunque cosa sia arrivata dal client.
  const isOnce = parsed.data.repeat === "once" || parsed.data.isTournament;
  const repo = await getActiveRepo();

  const input: TrainingRuleInput = {
    title: parsed.data.title,
    location: parsed.data.location,
    repeat: isOnce ? "once" : parsed.data.repeat,
    weekdays: isOnce ? [] : [...new Set(parsed.data.weekdays)].sort((a, b) => a - b),
    startTime: parsed.data.startTime,
    endTime: parsed.data.endTime,
    startDate: parsed.data.startDate,
    endDate: isOnce ? parsed.data.startDate : parsed.data.endDate || null,
    notes: parsed.data.notes ?? null,
    isActive: parsed.data.isActive,
    team: parsed.data.team,
    isTournament: parsed.data.isTournament,
  };

  const scheduleLabel = isOnce
    ? `il ${formatDateLong(input.startDate)}`
    : `${formatWeekdays(input.weekdays)} ${input.startTime}–${input.endTime}`;

  if (id) {
    await repo.updateTraining(id, input);
    if (notify) {
      await notifyCalendarChange(
        {
          title: "Allenamento modificato",
          body: `${input.title} · ${scheduleLabel} · ${input.location}`,
          url: input.team === "minivolley" ? "/minivolley" : "/",
        },
        input.team,
      );
    }
  } else {
    await repo.createTraining(input, session.sub);
    if (notify) {
      await notifyCalendarChange(
        {
          title: "Allenamento creato",
          body: `${input.title} · ${scheduleLabel} · ${input.location}`,
          url: input.team === "minivolley" ? "/minivolley" : "/",
        },
        input.team,
      );
    }
  }

  revalidatePath("/admin/allenamenti");
  revalidatePath("/admin/allenamenti/elenco");
  revalidatePath("/admin/minivolley");
  revalidatePath("/");
  revalidatePath("/minivolley");
  updateTag(PUBLIC_CALENDAR_TAG);
  redirect(input.team === "minivolley" ? "/admin/minivolley" : "/admin/allenamenti/elenco");
}

export async function setOccurrencePlanAction(formData: FormData): Promise<void> {
  const session = await requireStaffPage("allenamenti");
  const ruleId = formData.get("ruleId")?.toString();
  const date = formData.get("date")?.toString();
  const planId = formData.get("planId")?.toString();
  const isPublic = formData.get("isPublic") === "on";
  if (!ruleId || !date || !planId) return;

  const repo = await getActiveRepo();
  await repo.setTrainingOccurrencePlan(ruleId, date, planId, isPublic, session.sub);
  revalidatePath(`/admin/allenamenti/${ruleId}`);
  revalidatePath(`/admin/allenamenti/scheda/${ruleId}/${date}`);
  revalidatePath("/admin/allenamenti");
  revalidatePath("/");
  updateTag(PUBLIC_CALENDAR_TAG);

  const [training, plan] = await Promise.all([repo.getTraining(ruleId), repo.getTrainingPlan(planId)]);
  await notifyStaffChange({
    title: "Scheda assegnata a un allenamento",
    body: `${plan?.title ?? "Scheda"} · ${training?.title ?? "Allenamento"} del ${formatDateShort(date)}`,
    url: `/admin/allenamenti/scheda/${ruleId}/${date}`,
  });
}

export async function removeOccurrencePlanAction(formData: FormData): Promise<void> {
  await requireStaffPage("allenamenti");
  const ruleId = formData.get("ruleId")?.toString();
  const date = formData.get("date")?.toString();
  if (!ruleId || !date) return;

  const repo = await getActiveRepo();
  await repo.removeTrainingOccurrencePlan(ruleId, date);
  revalidatePath(`/admin/allenamenti/${ruleId}`);
  revalidatePath(`/admin/allenamenti/scheda/${ruleId}/${date}`);
  revalidatePath("/admin/allenamenti");
  revalidatePath("/");
  updateTag(PUBLIC_CALENDAR_TAG);
}

export async function deleteTrainingAction(formData: FormData): Promise<void> {
  await requireStaff();
  const id = formData.get("id")?.toString();
  if (!id) return;
  const repo = await getActiveRepo();
  const training = await repo.getTraining(id);
  if (!training) return;
  await requireStaffPage(training.team === "minivolley" ? "minivolley" : "allenamenti");
  const scheduleLabel =
    training.repeat === "once"
      ? `il ${formatDateLong(training.startDate)}`
      : `${formatWeekdays(training.weekdays)} ${training.startTime}–${training.endTime}`;
  await notifyCalendarChange(
    {
      title: "Allenamento eliminato",
      body: `${training.title} · ${scheduleLabel} · non è più in calendario.`,
      url: training.team === "minivolley" ? "/minivolley" : "/",
    },
    training.team,
  );
  revalidatePath("/admin/allenamenti");
  revalidatePath("/admin/allenamenti/elenco");
  revalidatePath("/admin/minivolley");
  revalidatePath("/");
  revalidatePath("/minivolley");
  updateTag(PUBLIC_CALENDAR_TAG);
}
