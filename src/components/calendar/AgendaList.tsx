"use client";

import { useState } from "react";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { ChevronRight, Dumbbell, Home, MapPin, Plane, Swords } from "lucide-react";
import { CATEGORY_BADGE, CATEGORY_LABELS, TRAINING_BADGE } from "@/lib/category";
import { cn } from "@/lib/cn";
import { EventDetailDialog, type EventAttendance, type EventPlan } from "./EventDetailDialog";
import type { CalendarEvent } from "@/lib/types";

function dateHeading(dateStr: string) {
  const date = parseISO(dateStr);
  if (isToday(date)) return "Oggi";
  if (isTomorrow(date)) return "Domani";
  return format(date, "EEEE d MMMM", { locale: it });
}

function isPastDate(dateStr: string) {
  return dateStr < format(new Date(), "yyyy-MM-dd");
}

export function AgendaList({
  eventsByDate,
  plansByEventId = {},
  attendanceByEventId = {},
  emptyMessage = "Nessun evento in programma per questo periodo.",
}: {
  eventsByDate: Map<string, CalendarEvent[]>;
  plansByEventId?: Record<string, EventPlan>;
  attendanceByEventId?: Record<string, EventAttendance>;
  emptyMessage?: string;
}) {
  const dates = [...eventsByDate.keys()].sort();
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  if (dates.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border-subtle bg-surface-muted px-6 py-10 text-center text-sm text-foreground/50">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {dates.map((dateStr) => {
        const isPast = isPastDate(dateStr);
        return (
          <div key={dateStr}>
            <h3
              className={cn(
                "mb-2.5 text-sm font-bold uppercase tracking-wide capitalize",
                isPast ? "text-foreground/35" : "text-sea-700",
              )}
            >
              {dateHeading(dateStr)}
            </h3>
            <div className="space-y-2.5">
              {eventsByDate.get(dateStr)!.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  isPast={isPast}
                  onSelect={() => setSelectedEvent(event)}
                />
              ))}
            </div>
          </div>
        );
      })}

      <EventDetailDialog
        event={selectedEvent}
        plan={selectedEvent ? plansByEventId[selectedEvent.id] : undefined}
        attendance={selectedEvent ? attendanceByEventId[selectedEvent.id] : undefined}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
}

function EventRow({
  event,
  isPast = false,
  onSelect,
}: {
  event: CalendarEvent;
  isPast?: boolean;
  onSelect: () => void;
}) {
  const rowClass = cn(
    "flex w-full items-center gap-3.5 rounded-xl border border-border-subtle bg-surface px-4 py-3.5 text-left transition-colors",
    isPast
      ? "opacity-60 grayscale hover:border-primary/15"
      : "shadow-sm shadow-sea-950/5 hover:border-primary/25 hover:bg-primary/[0.03]",
  );

  if (event.kind === "training") {
    return (
      <button type="button" onClick={onSelect} className={rowClass}>
        <span
          className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", TRAINING_BADGE)}
        >
          <Dumbbell className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-foreground">{event.title}</p>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                TRAINING_BADGE,
              )}
            >
              U14 · U15
            </span>
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-foreground/60">
            <span className="font-medium text-foreground/80">
              {event.startTime}–{event.endTime}
            </span>
            <span aria-hidden>·</span>
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{event.location}</span>
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-foreground/30" />
      </button>
    );
  }

  return (
    <button type="button" onClick={onSelect} className={rowClass}>
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          CATEGORY_BADGE[event.category],
        )}
      >
        <Swords className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-foreground">vs {event.opponent}</p>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
              CATEGORY_BADGE[event.category],
            )}
          >
            {CATEGORY_LABELS[event.category]}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground/50">
            {event.isHome ? <Home className="h-3.5 w-3.5" /> : <Plane className="h-3.5 w-3.5" />}
            {event.isHome ? "Casa" : "Trasferta"}
          </span>
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-foreground/60">
          <span className="font-medium text-foreground/80">{event.time}</span>
          <span aria-hidden>·</span>
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{event.location}</span>
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-foreground/30" />
    </button>
  );
}
