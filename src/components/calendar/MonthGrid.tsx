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
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAY_HEADERS.map((label) => (
          <div
            key={label}
            className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
          >
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

          return (
            <div
              key={dateStr}
              className={cn(
                "min-h-[7.5rem] border-b border-r border-border p-1.5 [&:nth-child(7n)]:border-r-0 [&:nth-last-child(-n+7)]:border-b-0",
                !inMonth && "bg-surface-muted",
              )}
            >
              <div className="mb-1 flex h-6 items-center px-1">
                <span
                  className={cn(
                    "tabular grid h-6 min-w-6 place-items-center rounded-full px-1 text-[13px] font-semibold",
                    isCurrentDay
                      ? "bg-primary text-primary-foreground shadow-[0_2px_6px_-1px_color-mix(in_oklab,var(--primary)_55%,transparent)]"
                      : !inMonth
                        ? "text-muted-foreground/45"
                        : isPast
                          ? "text-muted-foreground"
                          : "text-foreground",
                  )}
                >
                  {format(day, "d")}
                </span>
              </div>
              <div className={cn("flex flex-col gap-0.5", (isPast || !inMonth) && "opacity-55")}>
                {events.slice(0, MAX_VISIBLE_PER_DAY).map((event) => (
                  <EventPill
                    key={event.id}
                    event={event}
                    onSelect={onSelectEvent ? () => onSelectEvent(event) : undefined}
                  />
                ))}
                {events.length > MAX_VISIBLE_PER_DAY && (
                  <span className="px-1.5 text-[11px] font-semibold text-muted-foreground">
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
