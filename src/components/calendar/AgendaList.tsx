"use client";

import { useState } from "react";
import { format, isToday, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarX2, ChevronRight, ChevronUp, Clock, History, Home, MapPin, Plane } from "lucide-react";
import { matchTitle } from "@/lib/calendar";
import { CATEGORY_LABELS, categoryBadgeClass, categoryDotClass, MATCH_NO_CATEGORY_LABEL, trainingDotClass } from "@/lib/category";
import { cn } from "@/lib/cn";
import type { CalendarEvent } from "@/lib/types";

function isPastDate(dateStr: string) {
  return dateStr < format(new Date(), "yyyy-MM-dd");
}

const tagClass = "inline-flex items-center gap-1 rounded-full px-2 py-px text-[11px] font-semibold leading-[18px]";

/** Elenco cronologico degli eventi, raggruppati per giorno: colonna data a
 * sinistra (stile agenda), eventi a destra. */
export function AgendaList({
  eventsByDate,
  onSelectEvent,
  emptyMessage = "Nessun evento in programma per questo periodo.",
}: {
  eventsByDate: Map<string, CalendarEvent[]>;
  onSelectEvent: (event: CalendarEvent) => void;
  emptyMessage?: string;
}) {
  const [showPast, setShowPast] = useState(false);
  const allDates = [...eventsByDate.keys()].sort();
  const pastDates = allDates.filter(isPastDate);
  const upcomingDates = allDates.filter((d) => !isPastDate(d));
  // Solo quando il periodo mostrato contiene sia eventi passati sia futuri
  // (il mese corrente) ha senso nascondere di default i passati: su un mese
  // tutto passato o tutto futuro, navigato di proposito, si mostra sempre
  // tutto, senza alcun interruttore.
  const hasSplit = pastDates.length > 0 && upcomingDates.length > 0;
  const dates = hasSplit && !showPast ? upcomingDates : allDates;
  const pastEventCount = pastDates.reduce((sum, d) => sum + eventsByDate.get(d)!.length, 0);

  if (allDates.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed border-border-strong bg-surface/70 px-6 py-12 text-center">
        <span className="icon-chip mb-3 h-11 w-11 rounded-2xl">
          <CalendarX2 className="h-5 w-5" />
        </span>
        <p className="text-sm font-medium text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div>
      {hasSplit && (
        <button
          type="button"
          onClick={() => setShowPast((v) => !v)}
          className="mb-3 inline-flex items-center gap-1.5 rounded-lg py-1 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          {showPast ? (
            <>
              <ChevronUp className="h-4 w-4" />
              Nascondi gli eventi passati
            </>
          ) : (
            <>
              <History className="h-4 w-4" />
              Mostra anche {pastEventCount === 1 ? "l'evento passato" : `i ${pastEventCount} eventi passati`}
            </>
          )}
        </button>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        {dates.map((dateStr) => {
          const date = parseISO(dateStr);
          const past = isPastDate(dateStr);
          const today = isToday(date);
          return (
            <div
              key={dateStr}
              className={cn(
                "flex gap-3 border-b border-border px-3 py-2.5 last:border-b-0 sm:gap-4 sm:px-4",
                today && "bg-primary-soft/60",
              )}
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
                <p
                  className={cn(
                    "display-wide tabular text-[1.375rem] leading-7",
                    today ? "text-primary" : "text-foreground",
                  )}
                >
                  {format(date, "d")}
                </p>
              </div>
              <div className="min-w-0 flex-1 divide-y divide-border/70">
                {eventsByDate.get(dateStr)!.map((event) => (
                  <EventRow key={event.id} event={event} isPast={past} onSelect={() => onSelectEvent(event)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventRow({ event, isPast, onSelect }: { event: CalendarEvent; isPast: boolean; onSelect: () => void }) {
  const isTraining = event.kind === "training";
  const barClass = isTraining ? trainingDotClass(event.color) : categoryDotClass(event.category);
  const title = isTraining ? event.title : matchTitle(event);
  const time = isTraining ? `${event.startTime}–${event.endTime}` : event.time;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group flex w-full items-center gap-3 py-2 text-left",
        isPast && "opacity-55",
      )}
    >
      <span className={cn("w-1 self-stretch rounded-full", barClass)} aria-hidden />
      <span className="min-w-0 flex-1 py-0.5">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold text-foreground group-hover:text-primary">{title}</span>
          {!isTraining && (
            <span className={cn(tagClass, categoryBadgeClass(event.category))}>
              {event.category ? CATEGORY_LABELS[event.category] : MATCH_NO_CATEGORY_LABEL}
            </span>
          )}
          {!isTraining && event.isFriendly && <span className={cn(tagClass, "bg-muted text-muted-foreground")}>Amichevole</span>}
          {event.isTournament && <span className={cn(tagClass, "bg-accent text-accent-foreground")}>Torneo</span>}
          {isTraining && event.usual && (
            <span className={cn(tagClass, "bg-warning-soft text-warning")}>Orario o luogo cambiati</span>
          )}
          {!isTraining && event.resultSetsWon !== null && event.resultSetsLost !== null && (
            <span
              className={cn(
                tagClass,
                event.resultSetsWon > event.resultSetsLost
                  ? "bg-success-soft text-success"
                  : "bg-destructive/10 text-destructive",
              )}
            >
              {event.resultSetsWon > event.resultSetsLost ? "Vinta" : "Persa"} {event.resultSetsWon}–{event.resultSetsLost}
            </span>
          )}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            <span className="tabular font-semibold text-foreground/75">{time}</span>
          </span>
          {!isTraining && (
            <span className="inline-flex items-center gap-1">
              {event.isHome ? <Home className="h-3.5 w-3.5" /> : <Plane className="h-3.5 w-3.5" />}
              {event.isHome ? "Casa" : "Trasferta"}
            </span>
          )}
          <span className="inline-flex min-w-0 max-w-full items-center gap-1">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{event.location}</span>
          </span>
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}
