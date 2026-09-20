import type { Metadata } from "next";
import { format } from "date-fns";
import { ArrowLeft, CalendarRange, Puzzle } from "lucide-react";
import { getRepo } from "@/lib/db";
import { expandTrainings, getMonthGridRange, groupEventsByDate, occurrenceKey } from "@/lib/calendar";
import { parseMonthParam } from "@/lib/month";
import { LinkButton } from "@/components/ui/LinkButton";
import { MonthNav } from "@/components/calendar/MonthNav";
import { AdminTrainingCalendar } from "@/components/calendar/AdminTrainingCalendar";

export const metadata: Metadata = {
  title: "Calendario allenamenti",
};

export default async function TrainingCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const monthDate = parseMonthParam(month);

  const repo = await getRepo();
  const [trainings, occurrencePlans, plans] = await Promise.all([
    repo.listTrainings(),
    repo.listTrainingOccurrencePlans(),
    repo.listTrainingPlans(),
  ]);

  const { start, end } = getMonthGridRange(monthDate);
  const occurrencePlanIds = new Map(
    occurrencePlans.map((o) => [occurrenceKey(o.trainingRuleId, o.occurrenceDate), o.planId] as const),
  );
  const events = expandTrainings(trainings, start, end, occurrencePlanIds);
  const eventsByDate = groupEventsByDate(events);
  const planById = new Map(plans.map((p) => [p.id, p] as const));

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const monthEventsWithPlan = events.filter((e) => e.kind === "training" && e.planId).length;
  const monthEventsWithoutPlan = events.filter(
    (e) => e.kind === "training" && !e.planId && e.date >= todayStr,
  ).length;

  return (
    <div>
      <LinkButton href="/admin/allenamenti" variant="ghost" size="sm" className="mb-4 -ml-3.5">
        <ArrowLeft className="h-4 w-4" />
        Torna agli allenamenti
      </LinkButton>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">
            <CalendarRange className="h-3 w-3" />
            Allenamenti
          </p>
          <h1 className="mt-1.5 font-display text-2xl font-bold text-foreground">Calendario schede</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Un colpo d&apos;occhio su cosa si allena ogni giorno. Tocca una data per collegare o
            cambiare la scheda: vale solo per quel giorno.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <MonthNav monthDate={monthDate} basePath="/admin/allenamenti/calendario" />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="flex h-4 w-4 items-center justify-center rounded bg-[var(--color-training-soft)] text-[var(--color-training-strong)]">
              <Puzzle className="h-2.5 w-2.5" />
            </span>
            Scheda collegata ({monthEventsWithPlan})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-4 w-4 rounded border border-dashed border-foreground/30" />
            Da assegnare {monthEventsWithoutPlan > 0 && `(${monthEventsWithoutPlan})`}
          </span>
        </div>
      </div>

      <div className="mt-4">
        <AdminTrainingCalendar monthDate={monthDate} eventsByDate={eventsByDate} planById={planById} />
      </div>
    </div>
  );
}
