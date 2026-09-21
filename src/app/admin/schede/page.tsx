import type { Metadata } from "next";
import { format } from "date-fns";
import { Plus, Puzzle } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { formatDateLong } from "@/lib/format";
import { LinkButton } from "@/components/ui/LinkButton";
import { SchedeLibrary, type SchedeCardData } from "./SchedeLibrary";

export const metadata: Metadata = {
  title: "Schede allenamento",
};

export default async function TrainingPlansPage() {
  const repo = await getActiveRepo();
  const [plans, blocks, occurrencePlans] = await Promise.all([
    repo.listTrainingPlans(),
    repo.listTrainingBlocks(),
    repo.listTrainingOccurrencePlans(),
  ]);
  const blockMap = new Map(blocks.map((b) => [b.id, b] as const));

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const upcomingDatesByPlan = new Map<string, string[]>();
  for (const o of occurrencePlans) {
    if (o.occurrenceDate < todayStr) continue;
    const list = upcomingDatesByPlan.get(o.planId);
    if (list) list.push(o.occurrenceDate);
    else upcomingDatesByPlan.set(o.planId, [o.occurrenceDate]);
  }

  const cards: SchedeCardData[] = plans.map((plan) => {
    const totalMinutes = plan.blockIds.reduce((sum, id) => sum + (blockMap.get(id)?.durationMinutes ?? 0), 0);
    const upcomingDates = (upcomingDatesByPlan.get(plan.id) ?? []).sort();
    return {
      id: plan.id,
      title: plan.title,
      planDate: plan.planDate ? formatDateLong(plan.planDate) : null,
      notes: plan.notes,
      blockCount: plan.blockIds.length,
      totalMinutes,
      upcomingCount: upcomingDates.length,
      nearestDateLabel: upcomingDates[0] ? formatDateLong(upcomingDates[0]) : null,
    };
  });

  cards.sort((a, b) => {
    if (a.upcomingCount > 0 && b.upcomingCount > 0) {
      return (upcomingDatesByPlan.get(a.id)![0] ?? "").localeCompare(upcomingDatesByPlan.get(b.id)![0] ?? "");
    }
    if (a.upcomingCount > 0) return -1;
    if (b.upcomingCount > 0) return 1;
    return a.title.localeCompare(b.title, "it");
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Schede allenamento</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Visibili solo a Developer e Admin. Componi ogni scheda con blocchi riutilizzabili, in
            stile puzzle.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LinkButton href="/admin/schede/blocchi" variant="outline">
            <Puzzle className="h-4 w-4" />
            Libreria blocchi
          </LinkButton>
          <LinkButton href="/admin/schede/nuova">
            <Plus className="h-4 w-4" />
            Nuova scheda
          </LinkButton>
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border-subtle bg-surface px-6 py-12 text-center text-sm text-foreground/50">
          Nessuna scheda ancora. Crea la prima incollando il testo di un allenamento oppure
          componendola da zero con blocchi esistenti.
        </div>
      ) : (
        <SchedeLibrary plans={cards} />
      )}
    </div>
  );
}
