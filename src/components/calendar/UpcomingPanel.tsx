"use client";

import { useState } from "react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarCheck2, ChevronRight, Clock, MapPin } from "lucide-react";
import { matchTitle } from "@/lib/calendar";
import { CATEGORY_LABELS, categoryDotClass, trainingDotClass } from "@/lib/category";
import { cn } from "@/lib/cn";
import type { CalendarEvent } from "@/lib/types";
import { EventDetailDialog, type EventAttendance, type EventCallUps, type EventPlan } from "./EventDetailDialog";

function dotClass(event: CalendarEvent) {
  return event.kind === "match" ? categoryDotClass(event.category) : trainingDotClass(event.color);
}

function eventLabel(event: CalendarEvent) {
  return event.kind === "training" ? event.title : matchTitle(event);
}

function kindLabel(event: CalendarEvent) {
  if (event.kind === "training") return event.isTournament ? "Torneo" : "Allenamento";
  const category = event.category ? ` ${CATEGORY_LABELS[event.category]}` : "";
  if (event.isTournament) return `Torneo${category}`;
  return `Partita${category} · ${event.isHome ? "in casa" : "in trasferta"}`;
}

function relativeDay(dateStr: string) {
  const diff = differenceInCalendarDays(parseISO(dateStr), new Date());
  if (diff <= 0) return "Oggi";
  if (diff === 1) return "Domani";
  return `Tra ${diff} giorni`;
}

/**
 * "Prossimo appuntamento" in evidenza (data a foglietto di calendario,
 * titolo grande, ora e luogo) più i due-tre successivi in righe compatte:
 * risponde subito alla domanda di chi apre il sito — "quando è il prossimo
 * allenamento/partita?" — senza dover leggere il calendario.
 */
export function UpcomingPanel({
  events,
  plansByEventId,
  attendanceByEventId,
  callUpsByEventId,
  className,
}: {
  events: CalendarEvent[];
  plansByEventId: Record<string, EventPlan>;
  attendanceByEventId: Record<string, EventAttendance>;
  callUpsByEventId: Record<string, EventCallUps>;
  className?: string;
}) {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [first, ...rest] = events;

  if (!first) {
    return (
      <div className={cn("rounded-3xl border border-border bg-card/90 p-6 shadow-raised backdrop-blur", className)}>
        <p className="eyebrow">Prossimo appuntamento</p>
        <div className="mt-4 flex items-center gap-3">
          <span className="icon-chip">
            <CalendarCheck2 className="h-5 w-5" />
          </span>
          <p className="text-sm text-muted-foreground">Nessun impegno in programma nei prossimi 30 giorni.</p>
        </div>
      </div>
    );
  }

  const date = parseISO(first.date);
  const relative = relativeDay(first.date);

  return (
    <div className={cn("overflow-hidden rounded-3xl border border-border bg-card shadow-raised", className)}>
      <div className="flex items-center justify-between gap-3 px-5 pt-5 sm:px-6">
        <p className="eyebrow">Prossimo appuntamento</p>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-bold",
            relative === "Oggi" ? "bg-primary text-primary-foreground" : "bg-sand-100 text-sand-800",
          )}
        >
          {relative}
        </span>
      </div>

      <button
        type="button"
        onClick={() => setSelectedEvent(first)}
        className="group flex w-full items-center gap-4 px-5 pb-5 pt-4 text-left sm:gap-5 sm:px-6"
      >
        <span className="w-[4.5rem] shrink-0 overflow-hidden rounded-2xl border border-border bg-card text-center shadow-xs">
          <span className="block bg-primary py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-primary-foreground">
            {format(date, "EEE", { locale: it })}
          </span>
          <span className="display-wide tabular block pt-1.5 text-[2rem] leading-none text-foreground">
            {format(date, "d")}
          </span>
          <span className="block pb-1.5 pt-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {format(date, "MMM", { locale: it })}
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", dotClass(first))} aria-hidden />
            <span className="truncate">{kindLabel(first)}</span>
          </span>
          <span className="display-wide mt-1 block text-[1.375rem] leading-tight text-foreground transition-colors group-hover:text-primary sm:text-2xl">
            {eventLabel(first)}
          </span>
          <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              <span className="tabular font-semibold text-foreground/80">
                {first.kind === "training" ? `${first.startTime}–${first.endTime}` : first.time}
              </span>
            </span>
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="truncate">{first.location}</span>
            </span>
          </span>
        </span>
        <ChevronRight className="hidden h-5 w-5 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 sm:block" />
      </button>

      {rest.length > 0 && (
        <div className="border-t border-border bg-surface-muted/70 py-1.5">
          <ul>
            {rest.map((event) => (
              <li key={event.id}>
                <button
                  type="button"
                  onClick={() => setSelectedEvent(event)}
                  className="group flex w-full items-center gap-3 px-5 py-2 text-left transition-colors hover:bg-muted/70 sm:px-6"
                >
                  <span className="w-[4.5rem] shrink-0 text-[12px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                    {format(parseISO(event.date), "EEE d", { locale: it })}
                  </span>
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", dotClass(event))} aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground group-hover:text-primary">
                    {eventLabel(event)}
                  </span>
                  <span className="tabular shrink-0 text-sm text-muted-foreground">
                    {event.kind === "training" ? event.startTime : event.time}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <EventDetailDialog
        event={selectedEvent}
        plan={selectedEvent ? plansByEventId[selectedEvent.id] : undefined}
        attendance={selectedEvent ? attendanceByEventId[selectedEvent.id] : undefined}
        callUps={selectedEvent ? callUpsByEventId[selectedEvent.id] : undefined}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
}
