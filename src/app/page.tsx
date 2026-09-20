import { format } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarDays, Volleyball, Waves } from "lucide-react";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { MonthGrid } from "@/components/calendar/MonthGrid";
import { AgendaList } from "@/components/calendar/AgendaList";
import { CategoryFilter } from "@/components/calendar/CategoryFilter";
import { MonthNav } from "@/components/calendar/MonthNav";
import { UpcomingStrip } from "@/components/calendar/UpcomingStrip";
import { getRepo } from "@/lib/db";
import {
  expandTrainings,
  getMonthGridRange,
  groupEventsByDate,
  matchesToEvents,
  occurrenceKey,
  sortEvents,
} from "@/lib/calendar";
import { formatMonthParam, parseMonthParam } from "@/lib/month";
import type { Category } from "@/lib/types";
import type { EventPlan } from "@/components/calendar/EventDetailDialog";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const monthParamRaw = typeof params.month === "string" ? params.month : undefined;
  const catParamRaw = typeof params.cat === "string" ? params.cat : undefined;

  const monthDate = parseMonthParam(monthParamRaw);
  const monthParam = formatMonthParam(monthDate);
  const activeCategory: "all" | Category =
    catParamRaw === "U14" || catParamRaw === "U15" ? catParamRaw : "all";

  const { start, end } = getMonthGridRange(monthDate);
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");

  const repo = await getRepo();
  const [trainings, matches, occurrencePlans, plans, blocks] = await Promise.all([
    repo.listTrainings(),
    repo.listMatches({
      from: startStr,
      to: endStr,
      category: activeCategory === "all" ? undefined : activeCategory,
    }),
    repo.listTrainingOccurrencePlans(),
    repo.listTrainingPlans(),
    repo.listTrainingBlocks(),
  ]);

  const occurrencePlanIds = new Map(
    occurrencePlans.map((o) => [occurrenceKey(o.trainingRuleId, o.occurrenceDate), o.planId] as const),
  );
  const trainingEvents = expandTrainings(trainings, start, end, occurrencePlanIds);
  const matchEvents = matchesToEvents(matches);
  const monthEvents = sortEvents([...trainingEvents, ...matchEvents]);
  const eventsByDate = groupEventsByDate(monthEvents);

  const planById = new Map(plans.map((p) => [p.id, p] as const));
  const blockById = new Map(blocks.map((b) => [b.id, b] as const));
  const plansByEventId: Record<string, EventPlan> = {};
  for (const event of monthEvents) {
    if (event.kind !== "training" || !event.planId) continue;
    const plan = planById.get(event.planId);
    if (!plan) continue;
    const planBlocks = plan.blockIds
      .map((blockId) => blockById.get(blockId))
      .filter((b): b is NonNullable<typeof b> => Boolean(b))
      .map((b) => ({ id: b.id, title: b.title, durationMinutes: b.durationMinutes, content: b.content }));
    plansByEventId[event.id] = { title: plan.title, blocks: planBlocks };
  }

  const isCurrentMonthView = monthParam === formatMonthParam(new Date());
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const upcoming = isCurrentMonthView
    ? monthEvents.filter((event) => event.date >= todayStr).slice(0, 4)
    : [];

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      <section className="auth-stage relative overflow-hidden text-white">
        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="max-w-xl">
            <p className="eyebrow eyebrow-inverted">
              <Volleyball className="h-3 w-3" />
              Settore giovanile femminile
            </p>
            <h1 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
              Calendario allenamenti &amp; partite
            </h1>
            <p className="mt-4 flex items-center gap-2 text-sm text-sea-100/80 sm:text-base">
              <Waves className="h-4 w-4 shrink-0" />
              Under 14 e Under 15 · Lignano Sabbiadoro
            </p>
          </div>

          {upcoming.length > 0 && (
            <div className="mt-9">
              <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-sea-200/80">
                <CalendarDays className="h-3.5 w-3.5" />
                Prossimi impegni
              </p>
              <UpcomingStrip events={upcoming} />
            </div>
          )}
        </div>
      </section>

      <main className="app-surface w-full flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <MonthNav monthDate={monthDate} cat={activeCategory === "all" ? undefined : activeCategory} />
            <CategoryFilter active={activeCategory} month={monthParam} />
          </div>

          <div className="mt-6">
            <MonthGrid monthDate={monthDate} eventsByDate={eventsByDate} />
          </div>

          <div className="mt-9">
            <p className="eyebrow">Agenda</p>
            <h2 className="mb-4 mt-1.5 font-display text-lg font-bold capitalize text-foreground">
              Eventi di {format(monthDate, "MMMM", { locale: it })}
            </h2>
            <AgendaList eventsByDate={eventsByDate} plansByEventId={plansByEventId} />
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-border-subtle bg-surface px-5 py-4 text-xs font-medium text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-training)]" />
              Allenamento (U14 e U15 insieme)
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-u14)]" />
              Partita Under 14
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-u15)]" />
              Partita Under 15
            </span>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
