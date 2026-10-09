"use server";

import { revalidatePath, updateTag } from "next/cache";
import { getActiveRepo } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guard";
import { splitTrainingPlanWithAI, type AIFailure } from "@/lib/aiTrainingPlanParser";
import {
  cleanTrainingText,
  planBlocksToText,
  sameDivision,
  splitAtHeadings,
  type BlockHeading,
  type ParsedBlock,
} from "@/lib/trainingPlanParser";
import { PUBLIC_CALENDAR_TAG } from "@/lib/publicCalendarData";
import type { PlanBlock } from "@/lib/types";

/** Schede controllate per ogni chiamata: l'elenco completo lo scorre la pagina, un pezzo alla volta. */
const MAX_PLANS_PER_CHECK = 2;

export interface PlanSplitProposal {
  planId: string;
  planTitle: string;
  before: { title: string; durationMinutes: number }[];
  after: ParsedBlock[];
  /** Le righe scelte dall'IA: all'applicazione il server ridivide da qui, non si fida dei blocchi del browser. */
  headings: BlockHeading[];
}

export interface PlanSplitFailure {
  planId: string;
  planTitle: string;
  reason: AIFailure;
}

export interface PlanSplitCheck {
  proposals: PlanSplitProposal[];
  /** Schede già divise come le dividerebbe l'IA. */
  unchanged: number;
  /** Schede che l'IA non è riuscita a controllare, e perché: si possono riprovare. */
  failures: PlanSplitFailure[];
}

/**
 * Ricontrolla con l'IA la divisione in blocchi di alcune schede già salvate:
 * il testo di ogni scheda viene ricostruito dai suoi blocchi e diviso di
 * nuovo. Non salva nulla: restituisce le proposte, da confermare una per una.
 */
export async function checkPlanSplitsAction(planIds: string[]): Promise<PlanSplitCheck> {
  await requireStaffPage("schede");
  const repo = await getActiveRepo();
  const ids = [...new Set(planIds)].slice(0, MAX_PLANS_PER_CHECK);

  const results = await Promise.all(
    ids.map(async (id): Promise<PlanSplitProposal | PlanSplitFailure | "unchanged"> => {
      const plan = await repo.getTrainingPlan(id);
      if (!plan || plan.blocks.length === 0) return "unchanged";
      const result = await splitTrainingPlanWithAI(planBlocksToText(plan.blocks));
      if (!result.ok) return { planId: plan.id, planTitle: plan.title, reason: result.reason };
      const ai = result.value;
      // Testo prima del primo blocco: l'IA non riconosce la prima intestazione, meglio non toccare nulla.
      if (ai.blocks.length === 0 || ai.preamble) return { planId: plan.id, planTitle: plan.title, reason: "invalid" };
      if (sameDivision(plan.blocks, ai.blocks)) return "unchanged";
      return {
        planId: plan.id,
        planTitle: plan.title,
        before: plan.blocks.map(({ title, durationMinutes }) => ({ title, durationMinutes })),
        after: ai.blocks,
        headings: ai.headings,
      };
    }),
  );

  return {
    proposals: results.filter((r): r is PlanSplitProposal => typeof r === "object" && "headings" in r),
    unchanged: results.filter((r) => r === "unchanged").length,
    failures: results.filter((r): r is PlanSplitFailure => typeof r === "object" && "reason" in r),
  };
}

export interface ApplyPlanSplitState {
  error?: string;
  /** Blocchi che la scheda ha davvero dopo il salvataggio (riletti dal database). */
  blockCount?: number;
}

/**
 * Applica la nuova divisione proposta. Il contenuto dei blocchi viene di
 * nuovo ritagliato qui dal testo della scheda salvata, alle righe indicate:
 * nessun testo arriva dal browser, quindi nulla può essere inventato o perso.
 */
export async function applyPlanSplitAction(planId: string, headings: BlockHeading[]): Promise<ApplyPlanSplitState> {
  await requireStaffPage("schede");
  if (!Array.isArray(headings) || headings.length === 0 || headings.length > 60) {
    return { error: "Proposta non valida." };
  }
  const safeHeadings: BlockHeading[] = headings.map((h) => ({
    headingLine: String(h?.headingLine ?? "").slice(0, 500),
    title: String(h?.title ?? "").slice(0, 200),
    durationMinutes: Number(h?.durationMinutes) || 0,
  }));

  try {
    const repo = await getActiveRepo();
    const plan = await repo.getTrainingPlan(planId);
    if (!plan) return { error: "Scheda non trovata." };

    const split = splitAtHeadings(cleanTrainingText(planBlocksToText(plan.blocks)), safeHeadings);
    if (!split || split.preamble || split.blocks.length === 0) {
      return { error: "La scheda è cambiata nel frattempo: ricontrollala." };
    }

    const blocks: PlanBlock[] = split.blocks.map((b) => ({
      id: crypto.randomUUID(),
      title: b.title,
      durationMinutes: b.durationMinutes,
      content: b.content,
    }));
    await repo.updateTrainingPlan(plan.id, { title: plan.title, notes: plan.notes, blocks, team: plan.team });
    // Si dice "salvata" solo dopo aver riletto la scheda dal database: niente conferme a vuoto.
    const saved = await repo.getTrainingPlan(plan.id);
    if (!saved || saved.blocks.length !== blocks.length) {
      return { error: "La nuova divisione non risulta salvata. Riprova." };
    }

    revalidatePath("/admin/schede");
    revalidatePath(`/admin/schede/${plan.id}`);
    revalidatePath("/admin/allenamenti", "layout");
    revalidatePath(plan.team === "minivolley" ? "/minivolley" : "/");
    updateTag(PUBLIC_CALENDAR_TAG);
    return { blockCount: saved.blocks.length };
  } catch (err) {
    console.error("[applyPlanSplitAction]", err);
    return { error: "Non è stato possibile salvare la nuova divisione. Riprova." };
  }
}
