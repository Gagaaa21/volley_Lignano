import { format } from "date-fns";
import Image from "next/image";
import { CalendarDays, CalendarPlus, Dumbbell, Swords, Trophy, Volleyball, Waves } from "lucide-react";
import crest from "@/assets/minivolley-crest.png";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { CalendarLegend } from "@/components/calendar/CalendarLegend";
import { CalendarSection } from "@/components/calendar/CalendarSection";
import { MonthNav } from "@/components/calendar/MonthNav";
import { UpcomingStrip } from "@/components/calendar/UpcomingStrip";
import { getPublicCalendarData } from "@/lib/publicCalendarData";
import {
  expandTrainings,
  getMonthGridRange,
  groupEventsByDate,
  matchesToEvents,
  occurrenceKey,
  sortEvents,
} from "@/lib/calendar";
import { NO_CATEGORY_BADGE, TRAINING_BADGE } from "@/lib/category";
import { formatMonthParam, parseMonthParam } from "@/lib/month";
import type { EventAttendance, EventCallUps, EventPlan } from "@/components/calendar/EventDetailDialog";

const TORNEO_BADGE = "bg-foreground/8 text-foreground/60";

export default async function MinivolleyPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const monthParamRaw = typeof params.month === "string" ? params.month : undefined;

  const monthDate = parseMonthParam(monthParamRaw);
  const monthParam = formatMonthParam(monthDate);

  const { start, end } = getMonthGridRange(monthDate);
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");

  const { trainings, matches, occurrencePlans, plans, attendance, callUpsByMatchId } =
    await getPublicCalendarData(startStr, endStr, undefined, "minivolley");

  const occurrencePlanIds = new Map(
    occurrencePlans
      .filter((o) => o.isPublic)
      .map((o) => [occurrenceKey(o.trainingRuleId, o.occurrenceDate), o.planId] as const),
  );
  const trainingEvents = expandTrainings(trainings, start, end, occurrencePlanIds);
  const matchEvents = matchesToEvents(matches);
  const monthEvents = sortEvents([...trainingEvents, ...matchEvents]);
  const eventsByDate = groupEventsByDate(monthEvents);

  const planById = new Map(plans.map((p) => [p.id, p] as const));
  const plansByEventId: Record<string, EventPlan> = {};
  for (const event of monthEvents) {
    if (event.kind !== "training" || !event.planId) continue;
    const plan = planById.get(event.planId);
    if (!plan) continue;
    plansByEventId[event.id] = { title: plan.title, blocks: plan.blocks };
  }

  const attendanceByOccurrence = new Map(
    attendance.map((a) => [occurrenceKey(a.trainingRuleId, a.sessionDate), a.records] as const),
  );
  const attendanceByEventId: Record<string, EventAttendance> = {};
  for (const event of monthEvents) {
    if (event.kind !== "training") continue;
    const records = attendanceByOccurrence.get(occurrenceKey(event.ruleId, event.date));
    if (records) attendanceByEventId[event.id] = { records };
  }

  const callUpsByEventId: Record<string, EventCallUps> = {};
  for (const event of monthEvents) {
    if (event.kind !== "match") continue;
    const names = callUpsByMatchId[event.id];
    if (names && names.length > 0) callUpsByEventId[event.id] = { names };
  }

  const isCurrentMonthView = monthParam === formatMonthParam(new Date());
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const upcoming = isCurrentMonthView
    ? monthEvents.filter((event) => event.date >= todayStr).slice(0, 4)
    : [];

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader subtitle="Minivolley" team="minivolley" />

      <section className="auth-stage relative overflow-hidden">
        <Image
          src={crest}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 z-0 h-[26rem] w-[26rem] select-none object-contain opacity-[0.1] sm:-right-16 sm:-top-20 sm:h-[34rem] sm:w-[34rem]"
        />

        <div className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16 lg:px-8">
          <div className="max-w-xl">
            <p className="eyebrow">
              <Volleyball className="h-3 w-3" />
              Minivolley
            </p>
            <h1 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
              Calendario allenamenti &amp; partite
            </h1>
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground sm:text-base">
              <Waves className="h-4 w-4 shrink-0" />
              Minivolley · Lignano Sabbiadoro
            </p>
            <a
              href="/minivolley/calendario.ics"
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary/30 hover:bg-surface-muted"
            >
              <CalendarPlus className="h-4 w-4" />
              Aggiungi al calendario
            </a>
          </div>

          {upcoming.length > 0 && (
            <div className="mt-9">
              <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-foreground/45">
                <CalendarDays className="h-3.5 w-3.5" />
                Prossimi impegni
              </p>
              <UpcomingStrip
                events={upcoming}
                plansByEventId={plansByEventId}
                attendanceByEventId={attendanceByEventId}
                callUpsByEventId={callUpsByEventId}
              />
            </div>
          )}
        </div>

        <svg
          aria-hidden
          viewBox="0 0 1440 74"
          preserveAspectRatio="none"
          className="absolute inset-x-0 -bottom-px z-0 h-10 w-full text-background sm:h-14"
        >
          <path fill="currentColor" d="M0,74 L0,42 C240,10 480,10 720,30 C960,50 1200,50 1440,20 L1440,74 Z" />
        </svg>
      </section>

      <main className="app-surface w-full flex-1">
        <div className="mx-auto max-w-6xl px-4 pb-8 pt-6 sm:px-6 sm:pb-10 sm:pt-8 lg:px-8">
          <MonthNav monthDate={monthDate} basePath="/minivolley" />

          <CalendarSection
            monthDate={monthDate}
            eventsByDate={eventsByDate}
            plansByEventId={plansByEventId}
            attendanceByEventId={attendanceByEventId}
            callUpsByEventId={callUpsByEventId}
          />

          <CalendarLegend
            items={[
              { icon: Dumbbell, label: "Allenamento", badgeClass: TRAINING_BADGE },
              { icon: Trophy, label: "Torneo", badgeClass: TORNEO_BADGE },
              { icon: Swords, label: "Partita", badgeClass: NO_CATEGORY_BADGE },
            ]}
          />
        </div>
      </main>

      <PublicFooter tagline="Minivolley · Lignano Sabbiadoro" />
    </div>
  );
}
