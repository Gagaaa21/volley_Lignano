import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Dumbbell, Swords } from "lucide-react";
import { eventTime } from "@/lib/calendar";
import type { CalendarEvent } from "@/lib/types";

export function UpcomingStrip({ events }: { events: CalendarEvent[] }) {
  if (events.length === 0) return null;

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {events.map((event) => {
        const date = parseISO(event.date);
        const isMatch = event.kind === "match";
        return (
          <div
            key={event.id}
            className="flex min-w-[172px] shrink-0 flex-col gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm"
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-sand-200">
              {isMatch ? <Swords className="h-3.5 w-3.5" /> : <Dumbbell className="h-3.5 w-3.5" />}
              {format(date, "EEE d MMM", { locale: it })}
            </div>
            <p className="text-sm font-bold text-white">
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
