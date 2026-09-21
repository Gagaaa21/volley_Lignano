import { eachDayOfInterval, format, isSameMonth } from "date-fns";
import { getMonthGridRange } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import type { CalendarEvent } from "@/lib/types";
import { EventPill } from "./EventPill";

const WEEKDAY_HEADERS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const MAX_VISIBLE_PER_DAY = 3;

export function MonthGrid({
  monthDate,
  eventsByDate,
  onSelectEvent,
}: {
  monthDate: Date;
  eventsByDate: Map<string, CalendarEvent[]>;
  onSelectEvent?: (event: CalendarEvent) => void;
}) {
  const { start, end } = getMonthGridRange(monthDate);
  const days = eachDayOfInterval({ start, end });
  const todayStr = format(new Date(), "yyyy-MM-dd");

  return (
    <div className="hidden overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-sm shadow-sea-950/5 md:block">
      <div className="grid grid-cols-7 border-b border-border-subtle bg-surface-muted text-center text-xs font-semibold uppercase tracking-wide text-foreground/50">
        {WEEKDAY_HEADERS.map((label) => (
          <div key={label} className="py-2.5">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const inMonth = isSameMonth(day, monthDate);
          const events = eventsByDate.get(dateStr) ?? [];
          const isCurrentDay = dateStr === todayStr;
          const isPast = dateStr < todayStr;
          const dayOfWeek = day.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

          return (
            <div
              key={dateStr}
              className={cn(
                "min-h-28 border-b border-r border-border-subtle p-1.5 [&:nth-of-type(7n)]:border-r-0",
                !inMonth ? "bg-surface-muted/50" : isWeekend && "bg-sand-50/50",
              )}
            >
              <div className="flex justify-end">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                    isCurrentDay
                      ? "bg-sea-700 text-white shadow-sm shadow-sea-700/40 ring-2 ring-sea-700/20 ring-offset-1 ring-offset-surface"
                      : inMonth
                        ? isPast
                          ? "text-foreground/35"
                          : "text-foreground"
                        : "text-foreground/30",
                  )}
                >
                  {format(day, "d")}
                </span>
              </div>
              <div className={cn("mt-1 flex flex-col gap-1", isPast && "opacity-50 grayscale")}>
                {events.slice(0, MAX_VISIBLE_PER_DAY).map((event) => (
                  <EventPill
                    key={event.id}
                    event={event}
                    onSelect={onSelectEvent ? () => onSelectEvent(event) : undefined}
                  />
                ))}
                {events.length > MAX_VISIBLE_PER_DAY && (
                  <span className="px-1.5 text-[10px] font-medium text-foreground/50">
                    +{events.length - MAX_VISIBLE_PER_DAY} altri
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
