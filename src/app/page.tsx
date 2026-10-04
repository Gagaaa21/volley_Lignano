import { format } from "date-fns";
import Image from "next/image";
import { CalendarPlus } from "lucide-react";
import crest from "@/assets/lignano-crest.png";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicTour } from "@/components/tour/PublicTour";
import { CalendarSection } from "@/components/calendar/CalendarSection";
import { CategoryFilter } from "@/components/calendar/CategoryFilter";
import { MonthNav } from "@/components/calendar/MonthNav";
import { SeasonRecordSection } from "@/components/calendar/SeasonRecordSection";
import { StandingsSection } from "@/components/calendar/StandingsSection";
import { scheduleFederationRefresh } from "@/lib/federation/auto";
import { UpcomingPanel } from "@/components/calendar/UpcomingPanel";
import { buttonVariants } from "@/components/ui/button-variants";
import { getPublicCalendarData, getPublicSeasonRecord, getPublicStandings } from "@/lib/publicCalendarData";
import {
  expandTrainings,
  getMonthGridRange,
  getUpcomingAgendaRange,
  groupEventsByDate,
  matchesToEvents,
  occurrenceKey,
  sortEvents,
} from "@/lib/calendar";
import { formatMonthParam, parseMonthParam } from "@/lib/month";
import type { Category } from "@/lib/types";
import type { EventAttendance, EventCallUps, EventPlan } from "@/components/calendar/EventDetailDialog";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const monthParamRaw = typeof params.month === "string" ? params.month : undefined;
  const catParamRaw = typeof params.cat === "string" ? params.cat : undefined;

  const monthDate = parseMonthParam(monthParamRaw);
  const monthParam = formatMonthParam(monthDate);
  const activeCategory: "all" | Category =
    catParamRaw === "U14" || catParamRaw === "U15" ? catParamRaw : "all";

  const { start: gridStart, end: gridEnd } = getMonthGridRange(monthDate);
  const { start: agendaStart, end: agendaEnd } = getUpcomingAgendaRange();
  // L'intervallo interrogato copre l'unione tra la griglia del mese navigato
  // e la finestra fissa dei prossimi 30 giorni, così l'Agenda resta sempre
  // ancorata a oggi anche quando si sfoglia un mese diverso da quello attuale.
  const start = gridStart < agendaStart ? gridStart : agendaStart;
  const end = gridEnd > agendaEnd ? gridEnd : agendaEnd;
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");
  const agendaStartStr = format(agendaStart, "yyyy-MM-dd");
  const agendaEndStr = format(agendaEnd, "yyyy-MM-dd");

  const [
    { trainings, matches, occurrencePlans, plans, attendance, callUpsByMatchId },
    seasonRecord,
    standings,
  ] = await Promise.all([
    getPublicCalendarData(startStr, endStr, activeCategory === "all" ? undefined : activeCategory),
    getPublicSeasonRecord(),
    getPublicStandings(),
  ]);
  // Rilettura delle classifiche dalla federazione in secondo piano, solo se
  // i dati hanno più di 30 minuti (chi visita non aspetta mai il portale).
  scheduleFederationRefresh();

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

  // "Prossimo appuntamento" sempre ancorato a oggi (finestra fissa di 30
  // giorni), qualunque sia il mese sfogliato nel calendario sotto.
  const upcoming = monthEvents
    .filter((event) => event.date >= agendaStartStr && event.date <= agendaEndStr)
    .slice(0, 4);

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <PublicTour team="u14u15" />

      <section className="auth-stage relative overflow-hidden border-b border-border">
        <Image
          src={crest}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -left-28 -top-16 z-0 h-[24rem] w-[24rem] select-none object-contain opacity-[0.06] sm:-left-24 sm:h-[30rem] sm:w-[30rem]"
        />

        <div className="relative z-10 mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 pb-10 pt-10 sm:px-6 sm:pb-14 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:items-center lg:gap-14 lg:px-8">
          <div>
            <p className="eyebrow">Settore giovanile femminile</p>
            <h1 className="display-wide mt-3 text-[2.375rem] leading-[1.02] text-foreground sm:text-[3.25rem]">
              Calendario allenamenti &amp; partite
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground sm:text-base">
              Under 14 e Under 15 di Lignano Sabbiadoro: orari, luoghi, convocazioni e risultati, sempre
              aggiornati dallo staff.
            </p>
            <div className="mt-6">
              <a
                href="/calendario.ics"
                data-tour="public-ics-button"
                className={buttonVariants({ variant: "primary", size: "lg" })}
              >
                <CalendarPlus className="h-[18px] w-[18px]" />
                Aggiungi al tuo calendario
              </a>
            </div>
          </div>

          <UpcomingPanel
            events={upcoming}
            plansByEventId={plansByEventId}
            attendanceByEventId={attendanceByEventId}
            callUpsByEventId={callUpsByEventId}
          />
        </div>
      </section>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-14 pt-8 sm:px-6 sm:pt-10 lg:px-8">
        <CalendarSection
          monthDate={monthDate}
          eventsByDate={eventsByDate}
          plansByEventId={plansByEventId}
          attendanceByEventId={attendanceByEventId}
          callUpsByEventId={callUpsByEventId}
          monthNav={<MonthNav monthDate={monthDate} cat={activeCategory === "all" ? undefined : activeCategory} />}
          filters={<CategoryFilter active={activeCategory} month={monthParam} />}
        />

        <SeasonRecordSection records={seasonRecord} />

        <StandingsSection
          standings={standings.filter((entry) => activeCategory === "all" || entry.category === activeCategory)}
        />
      </main>

      <PublicFooter />
    </div>
  );
}
