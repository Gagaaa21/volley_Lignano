import type { Metadata } from "next";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { requireStaff, resolveActiveTeam } from "@/lib/auth/guard";
import { formatDateLong } from "@/lib/format";
import { LinkButton } from "@/components/ui/LinkButton";
import { SchedeLibrary, type SchedeCardData } from "./SchedeLibrary";

export const metadata: Metadata = {
  title: "Schede allenamento",
};

export default async function TrainingPlansPage() {
  const session = await requireStaff();
  const team = await resolveActiveTeam(session);
  const repo = await getActiveRepo();
  const [plans, occurrencePlans] = await Promise.all([
    repo.listTrainingPlans({ team }),
    repo.listTrainingOccurrencePlans(),
  ]);

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const upcomingDatesByPlan = new Map<string, string[]>();
  for (const o of occurrencePlans) {
    if (o.occurrenceDate < todayStr) continue;
    const list = upcomingDatesByPlan.get(o.planId);
    if (list) list.push(o.occurrenceDate);
    else upcomingDatesByPlan.set(o.planId, [o.occurrenceDate]);
  }

  const cards: SchedeCardData[] = plans.map((plan) => {
    const totalMinutes = plan.blocks.reduce((sum, b) => sum + b.durationMinutes, 0);
    const upcomingDates = (upcomingDatesByPlan.get(plan.id) ?? []).sort();
    return {
      id: plan.id,
      title: plan.title,
      notes: plan.notes,
      blockCount: plan.blocks.length,
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
            Visibili solo a Developer e Admin. Incolla il testo di un allenamento: viene diviso
            automaticamente in blocchi.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LinkButton href="/admin/schede/nuova">
            <Plus className="h-4 w-4" />
            Nuova scheda
          </LinkButton>
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border-subtle bg-surface px-6 py-12 text-center text-sm text-foreground/50">
          Nessuna scheda ancora. Crea la prima incollando il testo di un allenamento.
        </div>
      ) : (
        <SchedeLibrary plans={cards} />
      )}
    </div>
  );
}
