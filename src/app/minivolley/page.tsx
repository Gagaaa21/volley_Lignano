import { format } from "date-fns";
import Image from "next/image";
import { CalendarPlus, ClipboardCheck } from "lucide-react";
import crest from "@/assets/minivolley-crest.png";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicTour } from "@/components/tour/PublicTour";
import { CalendarSection } from "@/components/calendar/CalendarSection";
import { MonthNav } from "@/components/calendar/MonthNav";
import { UpcomingPanel } from "@/components/calendar/UpcomingPanel";
import { LinkButton } from "@/components/ui/LinkButton";
import { buttonVariants } from "@/components/ui/button-variants";
import { getPublicCalendarData } from "@/lib/publicCalendarData";
import {
  expandTrainings,
  getMonthGridRange,
  getUpcomingAgendaRange,
  groupEventsByDate,
  occurrenceKey,
  sortEvents,
} from "@/lib/calendar";
import { parseMonthParam } from "@/lib/month";
import type { EventAttendance, EventPlan } from "@/components/calendar/EventDetailDialog";

export default async function MinivolleyPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const monthParamRaw = typeof params.month === "string" ? params.month : undefined;

  const monthDate = parseMonthParam(monthParamRaw);

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

  // Niente sezione Partite per il Minivolley: solo tornei, già coperti
  // dagli allenamenti con isTournament (vedi getPublicCalendarData).
  const { trainings, occurrencePlans, plans, attendance } = await getPublicCalendarData(
    startStr,
    endStr,
    undefined,
    "minivolley",
  );

  const occurrencePlanIds = new Map(
    occurrencePlans
      .filter((o) => o.isPublic)
      .map((o) => [occurrenceKey(o.trainingRuleId, o.occurrenceDate), o.planId] as const),
  );
  const monthEvents = sortEvents(expandTrainings(trainings, start, end, occurrencePlanIds));
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

  // "Prossimo appuntamento" sempre ancorato a oggi (finestra fissa di 30
  // giorni), qualunque sia il mese sfogliato nel calendario sotto.
  const upcoming = monthEvents
    .filter((event) => event.date >= agendaStartStr && event.date <= agendaEndStr)
    .slice(0, 4);

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader team="minivolley" />
      <PublicTour team="minivolley" />

      <section className="auth-stage relative overflow-hidden border-b border-border">
        <Image
          src={crest}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -left-28 -top-16 z-0 h-[24rem] w-[24rem] select-none object-contain opacity-[0.07] sm:-left-24 sm:h-[30rem] sm:w-[30rem]"
        />

        <div className="relative z-10 mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 pb-10 pt-10 sm:px-6 sm:pb-14 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:items-center lg:gap-14 lg:px-8">
          <div>
            <p className="eyebrow">Minivolley · Lignano Sabbiadoro</p>
            <h1 className="display-wide mt-3 text-[2.375rem] leading-[1.02] text-foreground sm:text-[3.25rem]">
              Calendario allenamenti
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground sm:text-base">
              Orari, palestre e tornei del Minivolley, sempre aggiornati dallo staff.
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <a
                href="/minivolley/calendario.ics"
                data-tour="public-ics-button"
                className={buttonVariants({ variant: "primary", size: "lg" })}
              >
                <CalendarPlus className="h-[18px] w-[18px]" />
                Aggiungi al tuo calendario
              </a>
              <LinkButton href="/minivolley/presenze" variant="outline" size="lg">
                <ClipboardCheck className="h-[18px] w-[18px]" />
                Presenze
              </LinkButton>
            </div>
          </div>

          <UpcomingPanel
            events={upcoming}
            plansByEventId={plansByEventId}
            attendanceByEventId={attendanceByEventId}
            callUpsByEventId={{}}
          />
        </div>
      </section>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-14 pt-8 sm:px-6 sm:pt-10 lg:px-8">
        <CalendarSection
          monthDate={monthDate}
          eventsByDate={eventsByDate}
          plansByEventId={plansByEventId}
          attendanceByEventId={attendanceByEventId}
          callUpsByEventId={{}}
          monthNav={<MonthNav monthDate={monthDate} basePath="/minivolley" />}
        />
      </main>

      <PublicFooter tagline="Minivolley · Lignano Sabbiadoro" team="minivolley" />
    </div>
  );
}
