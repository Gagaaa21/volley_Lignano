"use client";

import { type ReactNode, useState } from "react";
import { eachDayOfInterval, format, isSameMonth, isToday } from "date-fns";
import { getMonthGridRange } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import { MonthNav } from "@/components/calendar/MonthNav";

const WEEKDAY_HEADERS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

export interface DayMarker {
  colorClass: string;
  label: string;
}

export function MonthCalendarPicker({
  monthDate,
  basePath,
  markersByDate,
  detailsByDate,
  emptyDetail,
  initialSelectedDate,
}: {
  monthDate: Date;
  basePath: string;
  markersByDate: Record<string, DayMarker[]>;
  detailsByDate: Record<string, ReactNode>;
  emptyDetail: ReactNode;
  initialSelectedDate: string;
}) {
  const [selected, setSelected] = useState(initialSelectedDate);
  const { start, end } = getMonthGridRange(monthDate);
  const days = eachDayOfInterval({ start, end });

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <MonthNav monthDate={monthDate} basePath={basePath} />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-sm shadow-sea-950/5">
        <div className="grid grid-cols-7 border-b border-border-subtle bg-surface-muted text-center text-[11px] font-semibold uppercase tracking-wide text-foreground/50 sm:text-xs">
          {WEEKDAY_HEADERS.map((label) => (
            <div key={label} className="py-2">
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const inMonth = isSameMonth(day, monthDate);
            const markers = markersByDate[dateStr] ?? [];
            const isSelected = dateStr === selected;
            const isCurrentDay = isToday(day);

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => setSelected(dateStr)}
                className={cn(
                  "flex min-h-16 flex-col items-center gap-1 border-b border-r border-border-subtle py-2 transition-colors [&:nth-of-type(7n)]:border-r-0 sm:min-h-20",
                  !inMonth && "bg-surface-muted/50",
                  isSelected && "bg-primary/8",
                  "hover:bg-primary/5",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                    isCurrentDay
                      ? "bg-sea-700 text-white"
                      : isSelected
                        ? "text-primary"
                        : inMonth
                          ? "text-foreground"
                          : "text-foreground/30",
                  )}
                >
                  {format(day, "d")}
                </span>
                <div className="flex min-h-[6px] items-center gap-0.5">
                  {markers.slice(0, 4).map((marker, idx) => (
                    <span
                      key={idx}
                      title={marker.label}
                      className={cn("h-1.5 w-1.5 rounded-full", marker.colorClass)}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5">{detailsByDate[selected] ?? emptyDetail}</div>
    </div>
  );
}
