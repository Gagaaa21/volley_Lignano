"use client";

import { useState } from "react";
import { MonthGrid } from "./MonthGrid";
import { AgendaList } from "./AgendaList";
import { EventDetailDialog, type EventAttendance, type EventCallUps, type EventPlan } from "./EventDetailDialog";
import type { CalendarEvent } from "@/lib/types";

/**
 * Racchiude vista mensile e agenda della home pubblica: condividono lo stesso
 * dettaglio evento, quindi lo stato del dialog vive qui, un livello sopra
 * entrambe, invece che duplicato in ciascuna. Il calendario mostra il mese
 * navigato (monthDate), ma l'agenda sotto resta sempre ancorata a oggi — una
 * finestra fissa di 30 giorni indipendente dalla navigazione del calendario
 * (vedi agendaEventsByDate, valorizzata a parte dalla pagina chiamante con
 * getUpcomingAgendaRange).
 */
export function CalendarSection({
  monthDate,
  eventsByDate,
  agendaEventsByDate,
  plansByEventId,
  attendanceByEventId,
  callUpsByEventId,
}: {
  monthDate: Date;
  eventsByDate: Map<string, CalendarEvent[]>;
  agendaEventsByDate: Map<string, CalendarEvent[]>;
  plansByEventId: Record<string, EventPlan>;
  attendanceByEventId: Record<string, EventAttendance>;
  callUpsByEventId: Record<string, EventCallUps>;
}) {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  return (
    <>
      <div className="mt-6" data-tour="public-calendar">
        <MonthGrid monthDate={monthDate} eventsByDate={eventsByDate} onSelectEvent={setSelectedEvent} />
      </div>

      <div className="mt-9">
        <p className="eyebrow">Agenda</p>
        <h2 className="mb-4 mt-1.5 font-display text-lg font-bold text-foreground">Prossimi 30 giorni</h2>
        <AgendaList eventsByDate={agendaEventsByDate} onSelectEvent={setSelectedEvent} />
      </div>

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
