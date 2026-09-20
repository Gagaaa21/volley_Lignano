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
    weekdays: z.array(z.number().int().min(0).max(6)).min(1, "Seleziona almeno un giorno della settimana."),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Orario di inizio non valido."),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "Orario di fine non valido."),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data di inizio non valida."),
    endDate: z
      .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")])
      .optional(),
    notes: z.string().optional(),
    isActive: z.boolean(),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "L'orario di fine deve essere successivo a quello di inizio.",
    path: ["endTime"],
  })
  .refine((data) => !data.endDate || data.endDate >= data.startDate, {
    message: "La data di fine deve essere successiva alla data di inizio.",
    path: ["endDate"],
  });

export interface TrainingFormState {
  error?: string;
}

function parseTrainingForm(formData: FormData) {
  return schema.safeParse({
    title: formData.get("title")?.toString().trim() || "Allenamento",
    location: formData.get("location")?.toString().trim() ?? "",
    weekdays: formData.getAll("weekdays").map((v) => Number(v)),
    startTime: formData.get("startTime")?.toString() ?? "",
    endTime: formData.get("endTime")?.toString() ?? "",
    startDate: formData.get("startDate")?.toString() ?? "",
    endDate: formData.get("endDate")?.toString() ?? "",
    notes: formData.get("notes")?.toString().trim() || undefined,
    isActive: formData.get("isActive") === "on",
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
  const input: TrainingRuleInput = {
    title: parsed.data.title,
    location: parsed.data.location,
    weekdays: [...new Set(parsed.data.weekdays)].sort((a, b) => a - b),
    startTime: parsed.data.startTime,
    endTime: parsed.data.endTime,
    startDate: parsed.data.startDate,
    endDate: parsed.data.endDate || null,
    notes: parsed.data.notes ?? null,
    isActive: parsed.data.isActive,
  };

  const repo = await getRepo();
  if (id) {
    await repo.updateTraining(id, input);
    await notifyCalendarChange({
      title: "Allenamento aggiornato",
      body: `${input.title} · ${formatWeekdays(input.weekdays)} ${input.startTime}–${input.endTime}`,
      url: "/",
    });
  } else {
    await repo.createTraining(input, session.sub);
    await notifyCalendarChange({
      title: "Nuovo allenamento",
      body: `${input.title} · ${formatWeekdays(input.weekdays)} ${input.startTime}–${input.endTime}`,
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
    await notifyCalendarChange({
      title: "Allenamento rimosso",
      body: `${training.title} · ${formatWeekdays(training.weekdays)} non è più in calendario.`,
      url: "/",
    });
  }
  revalidatePath("/admin/allenamenti");
  revalidatePath("/");
}
