"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { updateTag } from "next/cache";
import { z } from "zod";
import { getActiveRepo } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guard";
import { notifyCalendarChange, notifyStaffChange } from "@/lib/push";
import { formatDateLong, formatDateShort, formatWeekdays } from "@/lib/format";
import { PUBLIC_CALENDAR_TAG } from "@/lib/publicCalendarData";
import { DEFAULT_TRAINING_COLOR, TRAINING_COLORS, type TrainingRuleInput } from "@/lib/types";

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
    color: z.enum(TRAINING_COLORS),
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

/** Valori grezzi così come inseriti, riportati indietro insieme a un errore
 * (di validazione o di salvataggio) perché il form non li svuoti mai: senza
 * questo, un problema di rete/Supabase intermittente (più probabile quando
 * il sito è sotto carico) farebbe perdere tutto quello che si era digitato. */
export interface TrainingFormValues {
  title: string;
  location: string;
  repeat: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
  startDate: string;
  endDate: string;
  notes: string;
  isActive: boolean;
  isTournament: boolean;
  color: string;
}

export interface TrainingFormState {
  error?: string;
  values?: TrainingFormValues;
}

function readRawValues(formData: FormData): TrainingFormValues {
  return {
    title: formData.get("title")?.toString() ?? "",
    location: formData.get("location")?.toString() ?? "",
    repeat: formData.get("repeat")?.toString() === "once" ? "once" : "weekly",
    weekdays: formData.getAll("weekdays").map((v) => Number(v)),
    startTime: formData.get("startTime")?.toString() ?? "",
    endTime: formData.get("endTime")?.toString() ?? "",
    startDate: formData.get("startDate")?.toString() ?? "",
    endDate: formData.get("endDate")?.toString() ?? "",
    notes: formData.get("notes")?.toString() ?? "",
    isActive: formData.get("isActive") === "on",
    isTournament: formData.get("isTournament") === "on",
    color: formData.get("color")?.toString() ?? DEFAULT_TRAINING_COLOR,
  };
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
    color: formData.get("color")?.toString() ?? DEFAULT_TRAINING_COLOR,
  });
}

export async function saveTrainingAction(
  _prevState: TrainingFormState,
  formData: FormData,
): Promise<TrainingFormState> {
  const session = await requireStaffPage("allenamenti");
  const values = readRawValues(formData);
  const parsed = parseTrainingForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dati non validi.", values };
  }

  const id = formData.get("id")?.toString();
  const notify = formData.get("notify") === "on";
  // Un torneo è per natura un evento singolo: forza "once" anche se il
  // checkbox è stato spuntato senza passare dai radio Settimanale/Singolo
  // giorno (es. submit rapido), qualunque cosa sia arrivata dal client.
  const isOnce = parsed.data.repeat === "once" || parsed.data.isTournament;

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
    color: parsed.data.color,
  };

  const scheduleLabel = isOnce
    ? `il ${formatDateLong(input.startDate)}`
    : `${formatWeekdays(input.weekdays)} ${input.startTime}–${input.endTime}`;

  // Un errore qui (es. Supabase lento/irraggiungibile) non deve far perdere
  // quanto digitato: si torna al form con i valori originali invece di
  // lasciar risalire l'eccezione (che smonterebbe il form senza un
  // error.tsx dedicato).
  try {
    const repo = await getActiveRepo();
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
    // Solo il sito pubblico della squadra toccata: i due siti sono
    // indipendenti, modificare un allenamento U14/U15 non deve invalidare
    // (né tantomeno mostrare cambiamenti su) la pagina pubblica Minivolley
    // e viceversa.
    revalidatePath(input.team === "minivolley" ? "/minivolley" : "/");
    updateTag(PUBLIC_CALENDAR_TAG);
  } catch (err) {
    console.error("[saveTrainingAction]", err);
    return { error: "Non è stato possibile salvare l'allenamento. Riprova.", values };
  }

  redirect("/admin/allenamenti/elenco");
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
  const [training, plan] = await Promise.all([repo.getTraining(ruleId), repo.getTrainingPlan(planId)]);
  revalidatePath(`/admin/allenamenti/${ruleId}`);
  revalidatePath(`/admin/allenamenti/scheda/${ruleId}/${date}`);
  revalidatePath("/admin/allenamenti");
  revalidatePath(training?.team === "minivolley" ? "/minivolley" : "/");
  updateTag(PUBLIC_CALENDAR_TAG);
  await notifyStaffChange(
    {
      title: "Scheda assegnata a un allenamento",
      body: `${plan?.title ?? "Scheda"} · ${training?.title ?? "Allenamento"} del ${formatDateShort(date)}`,
      url: `/admin/allenamenti/scheda/${ruleId}/${date}`,
    },
    training?.team ?? "u14u15",
  );
}

export async function removeOccurrencePlanAction(formData: FormData): Promise<void> {
  await requireStaffPage("allenamenti");
  const ruleId = formData.get("ruleId")?.toString();
  const date = formData.get("date")?.toString();
  if (!ruleId || !date) return;

  const repo = await getActiveRepo();
  await repo.removeTrainingOccurrencePlan(ruleId, date);
  const training = await repo.getTraining(ruleId);
  revalidatePath(`/admin/allenamenti/${ruleId}`);
  revalidatePath(`/admin/allenamenti/scheda/${ruleId}/${date}`);
  revalidatePath("/admin/allenamenti");
  revalidatePath(training?.team === "minivolley" ? "/minivolley" : "/");
  updateTag(PUBLIC_CALENDAR_TAG);
}

export async function deleteTrainingAction(formData: FormData): Promise<void> {
  await requireStaffPage("allenamenti");
  const id = formData.get("id")?.toString();
  if (!id) return;
  const repo = await getActiveRepo();
  const training = await repo.getTraining(id);
  if (!training) return;
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
  revalidatePath(training.team === "minivolley" ? "/minivolley" : "/");
  updateTag(PUBLIC_CALENDAR_TAG);
}
