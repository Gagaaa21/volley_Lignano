"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Dumbbell, Swords, Trophy } from "lucide-react";
import { eventTime, matchTitle } from "@/lib/calendar";
import { categoryBadgeClass, categoryDotClass, trainingBadgeClass, trainingDotClass } from "@/lib/category";
import { cn } from "@/lib/cn";
import type { CalendarEvent } from "@/lib/types";
import { EventDetailDialog, type EventAttendance, type EventCallUps, type EventPlan } from "./EventDetailDialog";

function badgeClass(event: CalendarEvent) {
  return event.kind === "match" ? categoryBadgeClass(event.category) : trainingBadgeClass(event.color);
}

function dotClass(event: CalendarEvent) {
  return event.kind === "match" ? categoryDotClass(event.category) : trainingDotClass(event.color);
}

export function UpcomingStrip({
  events,
  plansByEventId,
  attendanceByEventId,
  callUpsByEventId,
}: {
  events: CalendarEvent[];
  plansByEventId: Record<string, EventPlan>;
  attendanceByEventId: Record<string, EventAttendance>;
  callUpsByEventId: Record<string, EventCallUps>;
}) {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  if (events.length === 0) return null;

  return (
    <>
      <div className="scroll-fade-x flex gap-3 overflow-x-auto pb-1">
        {events.map((event) => {
          const date = parseISO(event.date);
          const isMatch = event.kind === "match";
          return (
            <button
              key={event.id}
              type="button"
              onClick={() => setSelectedEvent(event)}
              className="relative flex w-[184px] shrink-0 flex-col gap-2.5 overflow-hidden rounded-2xl border border-border-subtle bg-surface px-4 py-3.5 text-left shadow-sm shadow-sea-950/5 transition-colors hover:border-primary/25 hover:bg-primary/[0.03]"
            >
              <span className={cn("absolute inset-y-0 left-0 w-1", dotClass(event))} aria-hidden />
              <div className="flex items-center gap-2">
                <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", badgeClass(event))}>
                  {isMatch ? (
                    <Swords className="h-3.5 w-3.5" />
                  ) : event.isTournament ? (
                    <Trophy className="h-3.5 w-3.5" />
                  ) : (
                    <Dumbbell className="h-3.5 w-3.5" />
                  )}
                </span>
                <span className="text-xs font-semibold uppercase tracking-wide text-foreground/45">
                  {format(date, "EEE d MMM", { locale: it })}
                </span>
              </div>
              <p className="truncate text-sm font-bold text-foreground">
                {isMatch ? matchTitle(event) : event.isTournament ? "Torneo" : "Allenamento"}
              </p>
              <p className="truncate text-xs text-foreground/55">
                {eventTime(event)} · {event.location}
              </p>
            </button>
          );
        })}
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
