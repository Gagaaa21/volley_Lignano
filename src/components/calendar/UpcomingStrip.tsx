import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Dumbbell, Swords } from "lucide-react";
import { eventTime } from "@/lib/calendar";
import type { CalendarEvent } from "@/lib/types";

function accentColor(event: CalendarEvent) {
  if (event.kind === "match") {
    return event.category === "U14" ? "var(--color-u14)" : "var(--color-u15)";
  }
  return "var(--color-sand-400)";
}

export function UpcomingStrip({ events }: { events: CalendarEvent[] }) {
  if (events.length === 0) return null;

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {events.map((event) => {
        const date = parseISO(event.date);
        const isMatch = event.kind === "match";
        const accent = accentColor(event);
        return (
          <div
            key={event.id}
            className="relative flex min-w-[184px] shrink-0 flex-col gap-2.5 overflow-hidden rounded-2xl border border-white/15 bg-white/10 px-4 py-3.5 backdrop-blur-sm"
          >
            <span
              className="absolute inset-y-0 left-0 w-1"
              style={{ backgroundColor: accent }}
              aria-hidden
            />
            <div className="flex items-center gap-2">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: `color-mix(in oklab, ${accent} 45%, transparent)` }}
              >
                {isMatch ? <Swords className="h-3.5 w-3.5" /> : <Dumbbell className="h-3.5 w-3.5" />}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-sand-200">
                {format(date, "EEE d MMM", { locale: it })}
              </span>
            </div>
            <p className="truncate text-sm font-bold text-white">
              {isMatch ? `vs ${event.opponent}` : "Allenamento"}
            </p>
            <p className="truncate text-xs text-sea-100/80">
              {eventTime(event)} · {event.location}
            </p>
          </div>
        );
      })}
    </div>
  );
}
