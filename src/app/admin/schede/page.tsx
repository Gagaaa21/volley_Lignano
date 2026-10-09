import type { Metadata } from "next";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { ClipboardList, Plus } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { requireStaff, resolveActiveTeam } from "@/lib/auth/guard";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionTour } from "@/components/tour/SectionTour";
import { SECTION_SCHEDE_STEPS } from "@/components/tour/sectionSteps";
import { isTrainingPlanAIAvailable } from "@/lib/aiTrainingPlanParser";
import { PlanSplitCheck } from "./PlanSplitCheck";
import { SchedeLibrary, type SchedeCardData } from "./SchedeLibrary";

export const metadata: Metadata = {
  title: "Schede allenamento",
};

// La divisione in blocchi con l'IA (con modelli di riserva) può richiedere
// qualche decina di secondi: 60 secondi restano entro il limite di ogni piano Vercel.
export const maxDuration = 60;

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
      nearestDateLabel: upcomingDates[0] ? format(parseISO(upcomingDates[0]), "EEE d MMM", { locale: it }) : null,
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

  // Schede con blocchi da poter ricontrollare con l'IA (solo se l'IA è configurata).
  const splitCheckPlans = isTrainingPlanAIAvailable()
    ? plans.filter((plan) => plan.blocks.length > 0).map((plan) => ({ id: plan.id, title: plan.title }))
    : [];

  return (
    <div>
      <PageHeader
        title="Schede allenamento"
        description="Visibili solo allo staff. Incolla il testo di un allenamento: l'IA lo divide da sola in blocchi."
        help={<SectionTour steps={SECTION_SCHEDE_STEPS} />}
        actions={
          <LinkButton href="/admin/schede/nuova" data-tour="section-schede-new">
            <Plus className="h-4 w-4" />
            Nuova scheda
          </LinkButton>
        }
      />

      {cards.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nessuna scheda ancora"
          description="Crea la prima incollando il testo di un allenamento."
        />
      ) : (
        <>
          {splitCheckPlans.length > 0 && (
            <div className="mb-6">
              <PlanSplitCheck plans={splitCheckPlans} />
            </div>
          )}
          <SchedeLibrary plans={cards} />
        </>
      )}
    </div>
  );
}
