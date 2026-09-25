import Link from "next/link";
import { eachDayOfInterval, format, isSameMonth, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Clock, Puzzle } from "lucide-react";
import { getMonthGridRange } from "@/lib/calendar";
import { trainingBadgeClass } from "@/lib/category";
import { cn } from "@/lib/cn";
import type { CalendarEvent, TrainingPlan } from "@/lib/types";

const WEEKDAY_HEADERS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const MAX_VISIBLE_PER_DAY = 2;

function Occ({
  event,
  planTitle,
}: {
  event: Extract<CalendarEvent, { kind: "training" }>;
  planTitle: string | null;
}) {
  const hasPlan = Boolean(planTitle);
  return (
    <Link
      href={`/admin/allenamenti/scheda/${event.ruleId}/${event.date}`}
      className={cn(
        "flex w-full min-w-0 items-start gap-1 rounded-md border px-1.5 py-1 text-left text-[10px] font-semibold leading-tight transition-colors sm:text-[11px]",
        hasPlan
          ? cn("border-transparent hover:opacity-80", trainingBadgeClass(event.color))
          : "border-dashed border-foreground/25 text-foreground/40 hover:border-primary/40 hover:text-primary",
      )}
      title={`${event.startTime} · ${planTitle ?? "Nessuna scheda"}`}
    >
      {hasPlan ? (
        <Puzzle className="mt-0.5 h-2.5 w-2.5 shrink-0" />
      ) : (
        <Clock className="mt-0.5 h-2.5 w-2.5 shrink-0" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate opacity-70">{event.startTime}</span>
        <span className="block truncate">{planTitle ?? "Nessuna scheda"}</span>
      </span>
    </Link>
  );
}

export function AdminTrainingCalendar({
  monthDate,
  eventsByDate,
  planById,
}: {
  monthDate: Date;
  eventsByDate: Map<string, CalendarEvent[]>;
  planById: Map<string, TrainingPlan>;
}) {
  const { start, end } = getMonthGridRange(monthDate);
  const days = eachDayOfInterval({ start, end });
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const dates = [...eventsByDate.keys()].sort();

  return (
    <>
      {/* Desktop: month grid with inline scheda pills */}
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
            const events = (eventsByDate.get(dateStr) ?? []) as Extract<CalendarEvent, { kind: "training" }>[];
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
                      isCurrentDay ? "bg-sea-700 text-white" : inMonth ? "text-foreground" : "text-foreground/30",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                </div>
                <div className="mt-1 flex flex-col gap-1">
                  {events.slice(0, MAX_VISIBLE_PER_DAY).map((event) => (
                    <Occ
                      key={event.id}
                      event={event}
                      planTitle={event.planId ? (planById.get(event.planId)?.title ?? null) : null}
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

      {/* Mobile: chronological agenda list */}
      <div className="space-y-5 md:hidden">
        {dates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-subtle bg-surface-muted px-6 py-10 text-center text-sm text-foreground/50">
            Nessun allenamento in programma questo mese.
          </div>
        ) : (
          dates.map((dateStr) => {
            const events = (eventsByDate.get(dateStr) ?? []) as Extract<CalendarEvent, { kind: "training" }>[];
            return (
              <div key={dateStr}>
                <h3 className="mb-2.5 text-sm font-bold uppercase tracking-wide text-sea-700 capitalize">
                  {format(parseISO(dateStr), "EEEE d MMMM", { locale: it })}
                </h3>
                <div className="space-y-2">
                  {events.map((event) => {
                    const planTitle = event.planId ? (planById.get(event.planId)?.title ?? null) : null;
                    return (
                      <Link
                        key={event.id}
                        href={`/admin/allenamenti/scheda/${event.ruleId}/${event.date}`}
                        className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface px-4 py-3 transition-colors hover:border-primary/25 hover:bg-primary/5"
                      >
                        <span
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                            planTitle ? trainingBadgeClass(event.color) : "bg-foreground/8 text-foreground/40",
                          )}
                        >
                          {planTitle ? <Puzzle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-foreground">{event.title}</p>
                          <p className="truncate text-sm text-foreground/60">
                            {event.startTime}–{event.endTime} ·{" "}
                            <span className={planTitle ? "font-medium text-primary" : ""}>
                              {planTitle ?? "Nessuna scheda"}
                            </span>
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
