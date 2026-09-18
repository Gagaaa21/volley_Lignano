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
  sortEvents,
} from "@/lib/calendar";
import { formatMonthParam, parseMonthParam } from "@/lib/month";
import type { Category } from "@/lib/types";

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
  const [trainings, matches] = await Promise.all([
    repo.listTrainings(),
    repo.listMatches({
      from: startStr,
      to: endStr,
      category: activeCategory === "all" ? undefined : activeCategory,
    }),
  ]);

  const trainingEvents = expandTrainings(trainings, start, end);
  const matchEvents = matchesToEvents(matches);
  const monthEvents = sortEvents([...trainingEvents, ...matchEvents]);
  const eventsByDate = groupEventsByDate(monthEvents);

  const isCurrentMonthView = monthParam === formatMonthParam(new Date());
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const upcoming = isCurrentMonthView
    ? monthEvents.filter((event) => event.date >= todayStr).slice(0, 4)
    : [];

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      <section className="relative overflow-hidden bg-gradient-to-br from-sea-600 via-sea-700 to-sea-950 text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 10%, white 0, transparent 30%), radial-gradient(circle at 85% 90%, white 0, transparent 35%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sand-200 backdrop-blur">
                <Volleyball className="h-3.5 w-3.5" />
                Settore giovanile femminile
              </span>
              <h1 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                Calendario allenamenti &amp; partite
              </h1>
              <p className="mt-3 flex items-center gap-2 text-sm text-sea-100/85 sm:text-base">
                <Waves className="h-4 w-4 shrink-0" />
                Under 14 e Under 15 · Lignano Sabbiadoro
              </p>
            </div>
          </div>

          {upcoming.length > 0 && (
            <div className="mt-8">
              <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sea-200">
                <CalendarDays className="h-3.5 w-3.5" />
                Prossimi impegni
              </p>
              <UpcomingStrip events={upcoming} />
            </div>
          )}
        </div>
      </section>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <MonthNav monthDate={monthDate} cat={activeCategory === "all" ? undefined : activeCategory} />
          <CategoryFilter active={activeCategory} month={monthParam} />
        </div>

        <div className="mt-6">
          <MonthGrid monthDate={monthDate} eventsByDate={eventsByDate} />
        </div>

        <div className="mt-8">
          <h2 className="mb-4 font-display text-lg font-bold capitalize text-foreground">
            Eventi di {format(monthDate, "MMMM", { locale: it })}
          </h2>
          <AgendaList eventsByDate={eventsByDate} />
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-border-subtle bg-surface px-5 py-4 text-xs font-medium text-foreground/60">
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
      </main>

      <PublicFooter />
    </div>
  );
}
