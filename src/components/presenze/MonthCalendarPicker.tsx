"use client";

import { type ReactNode, useState } from "react";
import { eachDayOfInterval, format, isSameMonth, isToday } from "date-fns";
import { getMonthGridRange } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import { MonthNav } from "@/components/calendar/MonthNav";

const WEEKDAY_HEADERS = ["L", "M", "M", "G", "V", "S", "D"];

export interface DayMarker {
  colorClass: string;
  label: string;
}

/** Calendario mensile "selettore": ogni giorno mostra dei pallini di stato
 * e, toccato, apre i dettagli nel pannello accanto (sotto, su mobile). */
export function MonthCalendarPicker({
  monthDate,
  basePath,
  markersByDate,
  detailsByDate,
  emptyDetail,
  initialSelectedDate,
  legend,
}: {
  monthDate: Date;
  basePath: string;
  markersByDate: Record<string, DayMarker[]>;
  detailsByDate: Record<string, ReactNode>;
  emptyDetail: ReactNode;
  initialSelectedDate: string;
  legend?: { colorClass: string; label: string }[];
}) {
  const [selected, setSelected] = useState(initialSelectedDate);
  const { start, end } = getMonthGridRange(monthDate);
  const days = eachDayOfInterval({ start, end });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div className="min-w-0">
        <MonthNav monthDate={monthDate} basePath={basePath} className="mb-4" />

        <div className="overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-card sm:p-3">
          <div className="grid grid-cols-7 pb-1">
            {WEEKDAY_HEADERS.map((label, i) => (
              <div
                key={i}
                className="py-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
              >
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
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
                  aria-pressed={isSelected}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-1.5 rounded-xl py-2 transition-colors sm:min-h-[4.25rem]",
                    isSelected ? "bg-primary-soft ring-2 ring-inset ring-primary/60" : "hover:bg-muted",
                    !inMonth && !isSelected && "opacity-40",
                  )}
                >
                  <span
                    className={cn(
                      "tabular grid h-7 w-7 place-items-center rounded-full text-[13px] font-semibold",
                      isCurrentDay
                        ? "bg-primary text-primary-foreground"
                        : isSelected
                          ? "text-primary"
                          : "text-foreground",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  <span className="flex min-h-[6px] items-center gap-0.5">
                    {markers.slice(0, 4).map((marker, idx) => (
                      <span key={idx} title={marker.label} className={cn("h-1.5 w-1.5 rounded-full", marker.colorClass)} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {legend && legend.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 px-1 text-[13px] text-muted-foreground">
            {legend.map((item) => (
              <li key={item.label} className="inline-flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full", item.colorClass)} aria-hidden />
                {item.label}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="lg:sticky lg:top-36 lg:pt-[3.25rem]">{detailsByDate[selected] ?? emptyDetail}</div>
    </div>
  );
}
