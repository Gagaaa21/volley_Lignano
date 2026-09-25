"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActiveRepo } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guard";
import type { TrainingBlockInput } from "@/lib/types";

const schema = z.object({
  title: z.string().min(1, "Inserisci un titolo."),
  durationMinutes: z.coerce
    .number()
    .int("La durata deve essere un numero intero di minuti.")
    .min(1, "La durata deve essere di almeno 1 minuto.")
    .max(600, "Durata troppo lunga."),
  content: z.string().optional(),
});

export interface BlockFormState {
  error?: string;
}

export async function saveBlockAction(
  _prevState: BlockFormState,
  formData: FormData,
): Promise<BlockFormState> {
  const session = await requireStaffPage("schede");
  const parsed = schema.safeParse({
    title: formData.get("title")?.toString().trim() ?? "",
    durationMinutes: formData.get("durationMinutes")?.toString() ?? "",
    content: formData.get("content")?.toString() ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
  }

  const id = formData.get("id")?.toString();
  const planId = formData.get("planId")?.toString();
  const input: TrainingBlockInput = {
    title: parsed.data.title,
    durationMinutes: parsed.data.durationMinutes,
    content: parsed.data.content?.trim() ?? "",
  };

  const repo = await getActiveRepo();
  if (id) {
    await repo.updateTrainingBlock(id, input);
    revalidatePath("/admin/schede");
    if (planId) {
      revalidatePath(`/admin/schede/${planId}`);
      redirect(`/admin/schede/${planId}`);
    }
    redirect("/admin/schede/blocchi");
  }

  const created = await repo.createTrainingBlock(input, session.sub);
  revalidatePath("/admin/schede");

  if (planId) {
    const plan = await repo.getTrainingPlan(planId);
    if (plan) {
      await repo.updateTrainingPlan(planId, {
        title: plan.title,
        notes: plan.notes,
        blockIds: [...plan.blockIds, created.id],
        team: plan.team,
      });
      redirect(`/admin/schede/${planId}`);
    }
  }

  redirect("/admin/schede/blocchi");
}

export async function deleteBlockAction(formData: FormData): Promise<void> {
  await requireStaffPage("schede");
  const id = formData.get("id")?.toString();
  if (!id) return;
  const repo = await getActiveRepo();
  await repo.deleteTrainingBlock(id);
  revalidatePath("/admin/schede");
  revalidatePath("/admin/schede/blocchi");
}
