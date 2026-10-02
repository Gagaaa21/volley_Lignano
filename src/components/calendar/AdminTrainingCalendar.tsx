import Link from "next/link";
import { eachDayOfInterval, format, isSameMonth, isToday, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarX2, ChevronRight, ClipboardList } from "lucide-react";
import { getMonthGridRange } from "@/lib/calendar";
import { trainingBadgeClass, trainingDotClass } from "@/lib/category";
import { cn } from "@/lib/cn";
import type { CalendarEvent, TrainingPlan } from "@/lib/types";

type TrainingEvent = Extract<CalendarEvent, { kind: "training" }>;

const WEEKDAY_HEADERS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const MAX_VISIBLE_PER_DAY = 3;

function occurrenceHref(event: TrainingEvent) {
  return `/admin/allenamenti/scheda/${event.ruleId}/${event.date}`;
}

/** Un allenamento nella griglia: pastiglia piena con il titolo della scheda
 * se ne ha una collegata, altrimenti una riga leggera (ora + titolo
 * dell'allenamento) con un cerchio vuoto — si vede cosa manca senza
 * riempire il calendario di riquadri tratteggiati. */
function Occ({ event, planTitle }: { event: TrainingEvent; planTitle: string | null }) {
  const hasPlan = Boolean(planTitle);
  return (
    <Link
      href={occurrenceHref(event)}
      className={cn(
        "flex w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 py-[3px] text-left text-[11.5px] leading-4 transition-colors",
        hasPlan
          ? cn("font-semibold hover:brightness-[0.97]", trainingBadgeClass(event.color))
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
      title={`${event.startTime} · ${event.title} · ${planTitle ?? "Nessuna scheda"}`}
    >
      {hasPlan ? (
        <span className={cn("h-2 w-2 shrink-0 rounded-full", trainingDotClass(event.color))} aria-hidden />
      ) : (
        <span className="h-2 w-2 shrink-0 rounded-full border-[1.5px] border-current opacity-70" aria-hidden />
      )}
      <span className="tabular shrink-0 font-semibold">{event.startTime}</span>
      <span className="truncate">{planTitle ?? event.title}</span>
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
  const monthPrefix = format(monthDate, "yyyy-MM");
  const dates = [...eventsByDate.keys()].filter((d) => d.startsWith(monthPrefix)).sort();
  const planTitleOf = (event: TrainingEvent) => (event.planId ? (planById.get(event.planId)?.title ?? null) : null);

  return (
    <>
      {/* Desktop: griglia mensile */}
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-card md:block">
        <div className="grid grid-cols-7 border-b border-border">
          {WEEKDAY_HEADERS.map((label) => (
            <div key={label} className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const inMonth = isSameMonth(day, monthDate);
            const events = (eventsByDate.get(dateStr) ?? []) as TrainingEvent[];
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
                        ? "bg-primary text-primary-foreground"
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
                <div className={cn("flex flex-col gap-0.5", (isPast || !inMonth) && "opacity-60")}>
                  {events.slice(0, MAX_VISIBLE_PER_DAY).map((event) => (
                    <Occ key={event.id} event={event} planTitle={planTitleOf(event)} />
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

      {/* Mobile: elenco per giorno */}
      <div className="md:hidden">
        {dates.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border-strong bg-surface/70 px-6 py-12 text-center">
            <span className="icon-chip mb-3 h-11 w-11 rounded-2xl">
              <CalendarX2 className="h-5 w-5" />
            </span>
            <p className="text-sm font-medium text-muted-foreground">Nessun allenamento in programma questo mese.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            {dates.map((dateStr) => {
              const date = parseISO(dateStr);
              const today = isToday(date);
              const past = dateStr < todayStr;
              const events = (eventsByDate.get(dateStr) ?? []) as TrainingEvent[];
              return (
                <div
                  key={dateStr}
                  className={cn("flex gap-3 border-b border-border px-3 py-2.5 last:border-b-0", today && "bg-primary-soft/60")}
                >
                  <div className={cn("w-11 shrink-0 pt-2 text-center", past && "opacity-55")}>
                    <p
                      className={cn(
                        "text-[11px] font-semibold uppercase tracking-[0.06em]",
                        today ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {today ? "Oggi" : format(date, "EEE", { locale: it })}
                    </p>
                    <p className={cn("display-wide tabular text-[1.375rem] leading-7", today ? "text-primary" : "text-foreground")}>
                      {format(date, "d")}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1 divide-y divide-border/70">
                    {events.map((event) => {
                      const planTitle = planTitleOf(event);
                      return (
                        <Link
                          key={event.id}
                          href={occurrenceHref(event)}
                          className={cn("group flex items-center gap-3 py-2", past && "opacity-55")}
                        >
                          <span className={cn("w-1 self-stretch rounded-full", trainingDotClass(event.color))} aria-hidden />
                          <span className="min-w-0 flex-1 py-0.5">
                            <span className="block truncate font-semibold text-foreground">{event.title}</span>
                            <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground">
                              <span className="tabular shrink-0 font-semibold text-foreground/75">
                                {event.startTime}–{event.endTime}
                              </span>
                              <ClipboardList className="ml-1 h-3.5 w-3.5 shrink-0" />
                              <span className={cn("truncate", planTitle && "font-medium text-primary")}>
                                {planTitle ?? "Nessuna scheda"}
                              </span>
                            </span>
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
