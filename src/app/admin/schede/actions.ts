"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRepo } from "@/lib/db";
import { requireStaff } from "@/lib/auth/guard";
import { parseTrainingPlanText } from "@/lib/trainingPlanParser";
import type { TrainingBlock } from "@/lib/types";

const createSchema = z.object({
  title: z.string().min(1, "Inserisci un titolo per la scheda."),
  planDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).optional(),
  notes: z.string().optional(),
  pastedText: z.string().optional(),
  blockIds: z.array(z.string()),
});

export interface PlanFormState {
  error?: string;
}

export async function createPlanAction(
  _prevState: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const session = await requireStaff();
  const parsed = createSchema.safeParse({
    title: formData.get("title")?.toString().trim() ?? "",
    planDate: formData.get("planDate")?.toString() ?? "",
    notes: formData.get("notes")?.toString().trim() || undefined,
    pastedText: formData.get("pastedText")?.toString() ?? "",
    blockIds: formData.getAll("blockIds").map((v) => v.toString()),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
  }

  const repo = await getRepo();
  const { preamble, blocks: parsedBlocks } = parseTrainingPlanText(parsed.data.pastedText ?? "");

  const existingBlocks = await repo.listTrainingBlocks();
  const byTitle = new Map(existingBlocks.map((b) => [b.title.trim().toLowerCase(), b] as const));

  const blockIds: string[] = [...new Set(parsed.data.blockIds)];
  for (const parsedBlock of parsedBlocks) {
    const key = parsedBlock.title.trim().toLowerCase();
    const existing: TrainingBlock | undefined = byTitle.get(key);
    if (existing) {
      if (!blockIds.includes(existing.id)) blockIds.push(existing.id);
      continue;
    }
    const created = await repo.createTrainingBlock(
      {
        title: parsedBlock.title,
        durationMinutes: parsedBlock.durationMinutes,
        content: parsedBlock.content,
      },
      session.sub,
    );
    byTitle.set(key, created);
    blockIds.push(created.id);
  }

  const plan = await repo.createTrainingPlan(
    {
      title: parsed.data.title,
      planDate: parsed.data.planDate || null,
      notes: parsed.data.notes || preamble || null,
      blockIds,
    },
    session.sub,
  );

  revalidatePath("/admin/schede");
  redirect(`/admin/schede/${plan.id}`);
}

const detailsSchema = z.object({
  title: z.string().min(1, "Inserisci un titolo per la scheda."),
  planDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).optional(),
  notes: z.string().optional(),
});

export async function updatePlanDetailsAction(
  _prevState: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  await requireStaff();
  const id = formData.get("id")?.toString();
  if (!id) return { error: "Scheda non valida." };

  const parsed = detailsSchema.safeParse({
    title: formData.get("title")?.toString().trim() ?? "",
    planDate: formData.get("planDate")?.toString() ?? "",
    notes: formData.get("notes")?.toString().trim() || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
  }

  const repo = await getRepo();
  const plan = await repo.getTrainingPlan(id);
  if (!plan) return { error: "Scheda non trovata." };

  await repo.updateTrainingPlan(id, {
    title: parsed.data.title,
    planDate: parsed.data.planDate || null,
    notes: parsed.data.notes ?? null,
    blockIds: plan.blockIds,
  });

  revalidatePath(`/admin/schede/${id}`);
  revalidatePath("/admin/schede");
  return {};
}

export async function deletePlanAction(formData: FormData): Promise<void> {
  await requireStaff();
  const id = formData.get("id")?.toString();
  if (!id) return;
  const repo = await getRepo();
  await repo.deleteTrainingPlan(id);
  revalidatePath("/admin/schede");
  redirect("/admin/schede");
}

export async function addBlockToPlanAction(formData: FormData): Promise<void> {
  await requireStaff();
  const planId = formData.get("planId")?.toString();
  const blockId = formData.get("blockId")?.toString();
  if (!planId || !blockId) return;

  const repo = await getRepo();
  const plan = await repo.getTrainingPlan(planId);
  if (!plan || plan.blockIds.includes(blockId)) return;

  await repo.updateTrainingPlan(planId, {
    title: plan.title,
    planDate: plan.planDate,
    notes: plan.notes,
    blockIds: [...plan.blockIds, blockId],
  });
  revalidatePath(`/admin/schede/${planId}`);
}

export async function removeBlockFromPlanAction(formData: FormData): Promise<void> {
  await requireStaff();
  const planId = formData.get("planId")?.toString();
  const blockId = formData.get("blockId")?.toString();
  if (!planId || !blockId) return;

  const repo = await getRepo();
  const plan = await repo.getTrainingPlan(planId);
  if (!plan) return;

  await repo.updateTrainingPlan(planId, {
    title: plan.title,
    planDate: plan.planDate,
    notes: plan.notes,
    blockIds: plan.blockIds.filter((id) => id !== blockId),
  });
  revalidatePath(`/admin/schede/${planId}`);
}

export async function reorderPlanBlockAction(formData: FormData): Promise<void> {
  await requireStaff();
  const planId = formData.get("planId")?.toString();
  const blockId = formData.get("blockId")?.toString();
  const direction = formData.get("direction")?.toString();
  if (!planId || !blockId || (direction !== "up" && direction !== "down")) return;

  const repo = await getRepo();
  const plan = await repo.getTrainingPlan(planId);
  if (!plan) return;

  const index = plan.blockIds.indexOf(blockId);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapWith < 0 || swapWith >= plan.blockIds.length) return;

  const nextBlockIds = [...plan.blockIds];
  [nextBlockIds[index], nextBlockIds[swapWith]] = [nextBlockIds[swapWith], nextBlockIds[index]];

  await repo.updateTrainingPlan(planId, {
    title: plan.title,
    planDate: plan.planDate,
    notes: plan.notes,
    blockIds: nextBlockIds,
  });
  revalidatePath(`/admin/schede/${planId}`);
}
