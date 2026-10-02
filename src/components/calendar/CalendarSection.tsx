"use client";

import { useMemo, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { CalendarDays, List } from "lucide-react";
import { SegmentedButtons } from "@/components/ui/Segmented";
import type { CalendarEvent } from "@/lib/types";
import { MonthGrid } from "./MonthGrid";
import { AgendaList } from "./AgendaList";
import { CalendarLegend } from "./CalendarLegend";
import { EventDetailDialog, type EventAttendance, type EventCallUps, type EventPlan } from "./EventDetailDialog";

type View = "grid" | "list";

/**
 * Calendario del mese navigato, in due viste che mostrano gli stessi eventi:
 * griglia mensile (predefinita su schermi larghi) ed elenco per giorno
 * (l'unica su mobile, dove una griglia di 7 colonne sarebbe illeggibile).
 * Il dettaglio evento è condiviso dalle due viste, quindi il suo stato vive
 * qui. La navigazione mese e gli eventuali filtri arrivano dalla pagina
 * (link con querystring, renderizzati lato server) e si affiancano al
 * selettore di vista nella stessa barra.
 */
export function CalendarSection({
  monthDate,
  eventsByDate,
  plansByEventId,
  attendanceByEventId,
  callUpsByEventId,
  monthNav,
  filters,
}: {
  monthDate: Date;
  eventsByDate: Map<string, CalendarEvent[]>;
  plansByEventId: Record<string, EventPlan>;
  attendanceByEventId: Record<string, EventAttendance>;
  callUpsByEventId: Record<string, EventCallUps>;
  monthNav: ReactNode;
  filters?: ReactNode;
}) {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [view, setView] = useState<View>("grid");

  // La griglia include anche i giorni di contorno dei mesi adiacenti;
  // l'elenco e la legenda si limitano al mese navigato.
  const monthPrefix = format(monthDate, "yyyy-MM");
  const monthEventsByDate = useMemo(
    () => new Map([...eventsByDate].filter(([date]) => date.startsWith(monthPrefix))),
    [eventsByDate, monthPrefix],
  );
  const monthEvents = useMemo(() => [...monthEventsByDate.values()].flat(), [monthEventsByDate]);

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {monthNav}
        <div className="flex w-full items-center gap-2 md:w-auto">
          {filters}
          <SegmentedButtons
            ariaLabel="Vista del calendario"
            className="hidden md:inline-flex"
            value={view}
            onChange={setView}
            items={[
              {
                value: "grid",
                label: (
                  <>
                    <CalendarDays className="h-4 w-4" />
                    Mese
                  </>
                ),
              },
              {
                value: "list",
                label: (
                  <>
                    <List className="h-4 w-4" />
                    Elenco
                  </>
                ),
              },
            ]}
          />
        </div>
      </div>

      <div data-tour="public-calendar">
        <div className={view === "grid" ? "hidden md:block" : "hidden"}>
          <MonthGrid monthDate={monthDate} eventsByDate={eventsByDate} onSelectEvent={setSelectedEvent} />
        </div>
        <div className={view === "list" ? undefined : "md:hidden"}>
          <AgendaList
            eventsByDate={monthEventsByDate}
            onSelectEvent={setSelectedEvent}
            emptyMessage="Nessun evento in programma in questo mese."
          />
        </div>
      </div>

      <CalendarLegend events={monthEvents} className="mt-4 px-1" />

      <EventDetailDialog
        event={selectedEvent}
        plan={selectedEvent ? plansByEventId[selectedEvent.id] : undefined}
        attendance={selectedEvent ? attendanceByEventId[selectedEvent.id] : undefined}
        callUps={selectedEvent ? callUpsByEventId[selectedEvent.id] : undefined}
        onClose={() => setSelectedEvent(null)}
      />
    </>
  );
}
