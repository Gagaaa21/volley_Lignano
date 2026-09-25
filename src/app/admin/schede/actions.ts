"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { updateTag } from "next/cache";
import { z } from "zod";
import { getActiveRepo } from "@/lib/db";
import { requireStaffPage, resolveActiveTeam } from "@/lib/auth/guard";
import { parseTrainingPlanText } from "@/lib/trainingPlanParser";
import { parseTrainingPlanWithAI } from "@/lib/aiTrainingPlanParser";
import { notifyStaffChange } from "@/lib/push";
import { formatDateShort } from "@/lib/format";
import { PUBLIC_CALENDAR_TAG } from "@/lib/publicCalendarData";
import type { PlanBlock } from "@/lib/types";

const createSchema = z.object({
  title: z.string().min(1, "Inserisci un titolo per la scheda."),
  notes: z.string().optional(),
  pastedText: z.string().optional(),
  useAi: z.boolean().optional(),
  occurrenceRuleId: z.string().optional(),
  occurrenceDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).optional(),
  isPublic: z.boolean().optional(),
});

export interface PlanFormState {
  error?: string;
}

export async function createPlanAction(
  _prevState: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const session = await requireStaffPage("schede");
  const parsed = createSchema.safeParse({
    title: formData.get("title")?.toString().trim() ?? "",
    notes: formData.get("notes")?.toString().trim() || undefined,
    pastedText: formData.get("pastedText")?.toString() ?? "",
    useAi: formData.get("useAi") === "on",
    occurrenceRuleId: formData.get("occurrenceRuleId")?.toString() || undefined,
    occurrenceDate: formData.get("occurrenceDate")?.toString() ?? "",
    isPublic: formData.get("isPublic") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
  }

  const repo = await getActiveRepo();
  const pastedText = parsed.data.pastedText ?? "";
  let { preamble, blocks: parsedBlocks } = parseTrainingPlanText(pastedText);

  if (pastedText.trim() && (parsed.data.useAi || parsedBlocks.length === 0)) {
    const aiResult = await parseTrainingPlanWithAI(pastedText);
    if (aiResult) {
      preamble = aiResult.preamble;
      parsedBlocks = aiResult.blocks;
    }
  }

  // I blocchi vivono solo dentro questa scheda: nessuna libreria condivisa
  // da riusare, così il testo appena incollato viene sempre salvato per
  // come è, senza rischio che un blocco vecchio con lo stesso titolo lo
  // sostituisca silenziosamente.
  const blocks: PlanBlock[] = parsedBlocks.map((b) => ({
    id: crypto.randomUUID(),
    title: b.title,
    durationMinutes: b.durationMinutes,
    content: b.content,
  }));

  // Se la scheda nasce collegata a un allenamento, eredita la squadra di
  // quell'allenamento (può differire dalla squadra attiva nello switcher, se
  // ad es. si è passati a un'altra sezione nel frattempo); altrimenti la
  // squadra attualmente selezionata nello switcher.
  const { occurrenceRuleId, occurrenceDate } = parsed.data;
  const occurrenceTraining = occurrenceRuleId ? await repo.getTraining(occurrenceRuleId) : null;
  const team = occurrenceTraining?.team ?? (await resolveActiveTeam(session));

  const plan = await repo.createTrainingPlan(
    {
      title: parsed.data.title,
      notes: parsed.data.notes || preamble || null,
      blocks,
      team,
    },
    session.sub,
  );

  revalidatePath("/admin/schede");

  if (occurrenceRuleId && occurrenceDate) {
    await repo.setTrainingOccurrencePlan(
      occurrenceRuleId,
      occurrenceDate,
      plan.id,
      parsed.data.isPublic ?? false,
      session.sub,
    );
    revalidatePath(`/admin/allenamenti/${occurrenceRuleId}`);
    revalidatePath(`/admin/allenamenti/scheda/${occurrenceRuleId}/${occurrenceDate}`);
    revalidatePath("/admin/allenamenti");
    revalidatePath("/");
    updateTag(PUBLIC_CALENDAR_TAG);

    await notifyStaffChange(
      {
        title: "Nuova scheda creata e assegnata",
        body: `${plan.title} · ${occurrenceTraining?.title ?? "Allenamento"} del ${formatDateShort(occurrenceDate)}`,
        url: `/admin/allenamenti/scheda/${occurrenceRuleId}/${occurrenceDate}`,
      },
      team,
    );

    redirect(`/admin/allenamenti/scheda/${occurrenceRuleId}/${occurrenceDate}`);
  }

  await notifyStaffChange(
    {
      title: "Nuova scheda creata",
      body: plan.title,
      url: `/admin/schede/${plan.id}`,
    },
    team,
  );

  redirect(`/admin/schede/${plan.id}`);
}

const detailsSchema = z.object({
  title: z.string().min(1, "Inserisci un titolo per la scheda."),
  notes: z.string().optional(),
});

export async function updatePlanDetailsAction(
  _prevState: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  await requireStaffPage("schede");
  const id = formData.get("id")?.toString();
  if (!id) return { error: "Scheda non valida." };

  const parsed = detailsSchema.safeParse({
    title: formData.get("title")?.toString().trim() ?? "",
    notes: formData.get("notes")?.toString().trim() || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
  }

  const repo = await getActiveRepo();
  const plan = await repo.getTrainingPlan(id);
  if (!plan) return { error: "Scheda non trovata." };

  await repo.updateTrainingPlan(id, {
    title: parsed.data.title,
    notes: parsed.data.notes ?? null,
    blocks: plan.blocks,
    team: plan.team,
  });

  revalidatePath(`/admin/schede/${id}`);
  revalidatePath("/admin/schede");
  return {};
}

export async function deletePlanAction(formData: FormData): Promise<void> {
  await requireStaffPage("schede");
  const id = formData.get("id")?.toString();
  if (!id) return;
  const repo = await getActiveRepo();
  await repo.deleteTrainingPlan(id);
  revalidatePath("/admin/schede");
  redirect("/admin/schede");
}

export async function removeBlockFromPlanAction(formData: FormData): Promise<void> {
  await requireStaffPage("schede");
  const planId = formData.get("planId")?.toString();
  const blockId = formData.get("blockId")?.toString();
  if (!planId || !blockId) return;

  const repo = await getActiveRepo();
  const plan = await repo.getTrainingPlan(planId);
  if (!plan) return;

  await repo.updateTrainingPlan(planId, {
    title: plan.title,
    notes: plan.notes,
    blocks: plan.blocks.filter((b) => b.id !== blockId),
    team: plan.team,
  });
  revalidatePath(`/admin/schede/${planId}`);
}

export async function reorderPlanBlockAction(formData: FormData): Promise<void> {
  await requireStaffPage("schede");
  const planId = formData.get("planId")?.toString();
  const blockId = formData.get("blockId")?.toString();
  const direction = formData.get("direction")?.toString();
  if (!planId || !blockId || (direction !== "up" && direction !== "down")) return;

  const repo = await getActiveRepo();
  const plan = await repo.getTrainingPlan(planId);
  if (!plan) return;

  const index = plan.blocks.findIndex((b) => b.id === blockId);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapWith < 0 || swapWith >= plan.blocks.length) return;

  const nextBlocks = [...plan.blocks];
  [nextBlocks[index], nextBlocks[swapWith]] = [nextBlocks[swapWith], nextBlocks[index]];

  await repo.updateTrainingPlan(planId, {
    title: plan.title,
    notes: plan.notes,
    blocks: nextBlocks,
    team: plan.team,
  });
  revalidatePath(`/admin/schede/${planId}`);
}
