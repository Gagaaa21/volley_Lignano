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
}: {
  monthDate: Date;
  eventsByDate: Map<string, CalendarEvent[]>;
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

          return (
            <div
              key={dateStr}
              className={cn(
                "min-h-28 border-b border-r border-border-subtle p-1.5 [&:nth-of-type(7n)]:border-r-0",
                !inMonth && "bg-surface-muted/50",
              )}
            >
              <div className="flex justify-end">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                    isCurrentDay
                      ? "bg-sea-700 text-white"
                      : inMonth
                        ? "text-foreground"
                        : "text-foreground/30",
                  )}
                >
                  {format(day, "d")}
                </span>
              </div>
              <div className="mt-1 flex flex-col gap-1">
                {events.slice(0, MAX_VISIBLE_PER_DAY).map((event) => (
                  <EventPill key={event.id} event={event} />
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
