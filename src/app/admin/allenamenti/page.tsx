import type { Metadata } from "next";
import { format } from "date-fns";
import { List, Plus, Puzzle } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { requireStaff, activeTeam } from "@/lib/auth/guard";
import { expandTrainings, getMonthGridRange, groupEventsByDate, occurrenceKey } from "@/lib/calendar";
import { parseMonthParam } from "@/lib/month";
import { LinkButton } from "@/components/ui/LinkButton";
import { MonthNav } from "@/components/calendar/MonthNav";
import { AdminTrainingCalendar } from "@/components/calendar/AdminTrainingCalendar";

export const metadata: Metadata = {
  title: "Allenamenti",
};

export default async function TrainingsCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const monthDate = parseMonthParam(month);
  const session = await requireStaff();
  const team = activeTeam(session);

  const repo = await getActiveRepo();
  const [trainings, occurrencePlans, plans] = await Promise.all([
    repo.listTrainings({ team }),
    repo.listTrainingOccurrencePlans(),
    repo.listTrainingPlans({ team }),
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Allenamenti</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Un colpo d&apos;occhio su cosa si allena ogni giorno. Tocca una data per collegare o
            cambiare la scheda: vale solo per quel giorno.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LinkButton href="/admin/allenamenti/elenco" variant="outline">
            <List className="h-4 w-4" />
            Elenco regole
          </LinkButton>
          <LinkButton href="/admin/allenamenti/nuovo">
            <Plus className="h-4 w-4" />
            Nuovo allenamento
          </LinkButton>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <MonthNav monthDate={monthDate} basePath="/admin/allenamenti" />
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
