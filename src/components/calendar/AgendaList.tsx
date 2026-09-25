"use client";

import { useState } from "react";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { ChevronRight, ChevronUp, Dumbbell, History, Home, MapPin, Plane, Swords, Trophy } from "lucide-react";
import { matchTitle } from "@/lib/calendar";
import { CATEGORY_BADGE, CATEGORY_LABELS, TRAINING_BADGE } from "@/lib/category";
import { cn } from "@/lib/cn";
import type { CalendarEvent } from "@/lib/types";

function dateHeading(dateStr: string) {
  const date = parseISO(dateStr);
  if (isToday(date)) return "Oggi";
  if (isTomorrow(date)) return "Domani";
  return format(date, "EEEE d MMMM", { locale: it });
}

function isPastDate(dateStr: string) {
  return dateStr < format(new Date(), "yyyy-MM-dd");
}

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
      <div className="rounded-2xl border border-dashed border-border-subtle bg-surface-muted px-6 py-10 text-center text-sm text-foreground/50">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {hasSplit && (
        <button
          type="button"
          onClick={() => setShowPast((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold text-foreground/50 transition-colors hover:text-primary"
        >
          {showPast ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Nascondi gli eventi passati
            </>
          ) : (
            <>
              <History className="h-3.5 w-3.5" />
              Mostra anche {pastEventCount === 1 ? "l'evento passato" : `i ${pastEventCount} eventi passati`} di
              questo mese
            </>
          )}
        </button>
      )}
      {dates.map((dateStr) => {
        const isPast = isPastDate(dateStr);
        return (
          <div key={dateStr}>
            <h3
              className={cn(
                "mb-2.5 text-sm font-bold uppercase tracking-wide capitalize",
                isPast ? "text-foreground/35" : "text-sea-700",
              )}
            >
              {dateHeading(dateStr)}
            </h3>
            <div className="space-y-2.5">
              {eventsByDate.get(dateStr)!.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  isPast={isPast}
                  onSelect={() => onSelectEvent(event)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EventRow({
  event,
  isPast = false,
  onSelect,
}: {
  event: CalendarEvent;
  isPast?: boolean;
  onSelect: () => void;
}) {
  const rowClass = cn(
    "flex w-full items-center gap-3.5 rounded-xl border border-border-subtle bg-surface px-4 py-3.5 text-left transition-colors",
    isPast
      ? "opacity-60 grayscale hover:border-primary/15"
      : "shadow-sm shadow-sea-950/5 hover:border-primary/25 hover:bg-primary/[0.03]",
  );

  if (event.kind === "training") {
    return (
      <button type="button" onClick={onSelect} className={rowClass}>
        <span
          className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", TRAINING_BADGE)}
        >
          {event.isTournament ? <Trophy className="h-4.5 w-4.5" /> : <Dumbbell className="h-4.5 w-4.5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-foreground">{event.title}</p>
            {event.team === "u14u15" && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                  TRAINING_BADGE,
                )}
              >
                U14 · U15
              </span>
            )}
            {event.isTournament && (
              <span className="rounded-full bg-foreground/8 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-foreground/50">
                Torneo
              </span>
            )}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-foreground/60">
            <span className="font-medium text-foreground/80">
              {event.startTime}–{event.endTime}
            </span>
            <span aria-hidden>·</span>
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{event.location}</span>
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-foreground/30" />
      </button>
    );
  }

  return (
    <button type="button" onClick={onSelect} className={rowClass}>
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          CATEGORY_BADGE[event.category],
        )}
      >
        <Swords className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-foreground">{matchTitle(event)}</p>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
              CATEGORY_BADGE[event.category],
            )}
          >
            {CATEGORY_LABELS[event.category]}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground/50">
            {event.isHome ? <Home className="h-3.5 w-3.5" /> : <Plane className="h-3.5 w-3.5" />}
            {event.isHome ? "Casa" : "Trasferta"}
          </span>
          {event.isFriendly && (
            <span className="rounded-full bg-foreground/8 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-foreground/50">
              Amichevole
            </span>
          )}
          {event.isTournament && (
            <span className="rounded-full bg-foreground/8 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-foreground/50">
              Torneo
            </span>
          )}
          {event.resultSetsWon !== null && event.resultSetsLost !== null && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                event.resultSetsWon > event.resultSetsLost
                  ? "bg-[var(--color-u14-soft)] text-[var(--color-u14-strong)]"
                  : "bg-destructive/10 text-destructive",
              )}
            >
              {event.resultSetsWon > event.resultSetsLost ? "Vinta" : "Persa"} {event.resultSetsWon}-
              {event.resultSetsLost}
            </span>
          )}
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-foreground/60">
          <span className="font-medium text-foreground/80">{event.time}</span>
          <span aria-hidden>·</span>
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{event.location}</span>
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-foreground/30" />
    </button>
  );
}
