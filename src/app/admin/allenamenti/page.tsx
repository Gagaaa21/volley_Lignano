import type { Metadata } from "next";
import { format } from "date-fns";
import { List, Plus } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { requireStaff, resolveActiveTeam } from "@/lib/auth/guard";
import { expandTrainings, getMonthGridRange, groupEventsByDate, occurrenceKey } from "@/lib/calendar";
import { parseMonthParam } from "@/lib/month";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { MonthNav } from "@/components/calendar/MonthNav";
import { AdminTrainingCalendar } from "@/components/calendar/AdminTrainingCalendar";
import { SectionTour } from "@/components/tour/SectionTour";
import { SECTION_ALLENAMENTI_STEPS } from "@/components/tour/sectionSteps";

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
  const team = await resolveActiveTeam(session);

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
      <PageHeader
        title="Allenamenti"
        description="Tocca un allenamento per collegare o cambiare la scheda di quel giorno."
        help={<SectionTour steps={SECTION_ALLENAMENTI_STEPS} />}
        actions={
          <div className="flex flex-wrap items-center gap-2" data-tour="section-allenamenti-toolbar">
            <LinkButton href="/admin/allenamenti/elenco" variant="outline">
              <List className="h-4 w-4" />
              Elenco regole
            </LinkButton>
            <LinkButton href="/admin/allenamenti/nuovo">
              <Plus className="h-4 w-4" />
              Nuovo allenamento
            </LinkButton>
          </div>
        }
      />

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <MonthNav monthDate={monthDate} basePath="/admin/allenamenti" />
        <div
          className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-muted-foreground"
          data-tour="section-allenamenti-legend"
        >
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" aria-hidden />
            Con scheda <span className="tabular font-semibold text-foreground">{monthEventsWithPlan}</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full border-[1.5px] border-muted-foreground" aria-hidden />
            Da assegnare <span className="tabular font-semibold text-foreground">{monthEventsWithoutPlan}</span>
          </span>
        </div>
      </div>

      <div data-tour="section-allenamenti-calendar">
        <AdminTrainingCalendar monthDate={monthDate} eventsByDate={eventsByDate} planById={planById} />
      </div>
    </div>
  );
}
