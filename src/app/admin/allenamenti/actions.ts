"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRepo } from "@/lib/db";
import { requireStaff } from "@/lib/auth/guard";
import { notifyCalendarChange } from "@/lib/push";
import { formatWeekdays } from "@/lib/format";
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
    blockIds: z.array(z.string()),
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
    blockIds: formData.getAll("blockIds").map((v) => v.toString()),
  });
}

export async function saveTrainingAction(
  _prevState: TrainingFormState,
  formData: FormData,
): Promise<TrainingFormState> {
  const session = await requireStaff();
  const parsed = parseTrainingForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
  }

  const id = formData.get("id")?.toString();
  const isOnce = parsed.data.repeat === "once";
  const repo = await getRepo();

  const existing = id ? await repo.getTraining(id) : null;
  const blockIds = [...new Set(parsed.data.blockIds)];
  let planId = existing?.planId ?? null;
  if (blockIds.length > 0) {
    if (planId) {
      const plan = await repo.getTrainingPlan(planId);
      if (plan) {
        await repo.updateTrainingPlan(planId, {
          title: plan.title,
          planDate: plan.planDate,
          notes: plan.notes,
          blockIds,
        });
      } else {
        planId = null;
      }
    }
    if (!planId) {
      const created = await repo.createTrainingPlan(
        {
          title: parsed.data.title,
          planDate: isOnce ? parsed.data.startDate : null,
          notes: null,
          blockIds,
        },
        session.sub,
      );
      planId = created.id;
    }
  } else {
    planId = null;
  }

  const input: TrainingRuleInput = {
    title: parsed.data.title,
    location: parsed.data.location,
    repeat: parsed.data.repeat,
    weekdays: isOnce ? [] : [...new Set(parsed.data.weekdays)].sort((a, b) => a - b),
    startTime: parsed.data.startTime,
    endTime: parsed.data.endTime,
    startDate: parsed.data.startDate,
    endDate: isOnce ? parsed.data.startDate : parsed.data.endDate || null,
    notes: parsed.data.notes ?? null,
    isActive: parsed.data.isActive,
    planId,
  };

  const scheduleLabel = isOnce
    ? `il ${input.startDate}`
    : `${formatWeekdays(input.weekdays)} ${input.startTime}–${input.endTime}`;

  if (id) {
    await repo.updateTraining(id, input);
    await notifyCalendarChange({
      title: "Allenamento aggiornato",
      body: `${input.title} · ${scheduleLabel}`,
      url: "/",
    });
  } else {
    await repo.createTraining(input, session.sub);
    await notifyCalendarChange({
      title: "Nuovo allenamento",
      body: `${input.title} · ${scheduleLabel}`,
      url: "/",
    });
  }

  revalidatePath("/admin/allenamenti");
  revalidatePath("/");
  redirect("/admin/allenamenti");
}

export async function deleteTrainingAction(formData: FormData): Promise<void> {
  await requireStaff();
  const id = formData.get("id")?.toString();
  if (!id) return;
  const repo = await getRepo();
  const training = await repo.getTraining(id);
  await repo.deleteTraining(id);
  if (training) {
    const scheduleLabel =
      training.repeat === "once" ? `il ${training.startDate}` : formatWeekdays(training.weekdays);
    await notifyCalendarChange({
      title: "Allenamento rimosso",
      body: `${training.title} · ${scheduleLabel} non è più in calendario.`,
      url: "/",
    });
  }
  revalidatePath("/admin/allenamenti");
  revalidatePath("/");
}
