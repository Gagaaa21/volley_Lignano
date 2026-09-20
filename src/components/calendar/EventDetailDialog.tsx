"use client";

import { useEffect } from "react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Clock, Dumbbell, ExternalLink, Home, MapPin, Plane, Swords, X } from "lucide-react";
import { CATEGORY_BADGE, CATEGORY_LABELS, TRAINING_BADGE } from "@/lib/category";
import { cn } from "@/lib/cn";
import type { CalendarEvent } from "@/lib/types";

export function EventDetailDialog({
  event,
  onClose,
}: {
  event: CalendarEvent | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!event) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [event, onClose]);

  if (!event) return null;

  const isTraining = event.kind === "training";
  const dateObj = parseISO(event.date);
  const badgeClass = isTraining ? TRAINING_BADGE : CATEGORY_BADGE[event.category];
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-sea-950/50 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-t-2xl border border-border-subtle bg-surface p-5 shadow-[0_-20px_50px_-20px_rgba(9,27,38,0.35)] sm:rounded-2xl sm:p-6 sm:shadow-[0_20px_50px_-20px_rgba(9,27,38,0.35)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Dettagli evento"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", badgeClass)}>
              {isTraining ? <Dumbbell className="h-5 w-5" /> : <Swords className="h-5 w-5" />}
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-bold text-foreground">
                {isTraining ? event.title : `vs ${event.opponent}`}
              </p>
              <span
                className={cn(
                  "mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                  badgeClass,
                )}
              >
                {isTraining ? "U14 · U15" : CATEGORY_LABELS[event.category]}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="shrink-0 rounded-full p-1.5 text-foreground/40 transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-3 text-sm">
          <p className="capitalize font-medium text-foreground">
            {format(dateObj, "EEEE d MMMM yyyy", { locale: it })}
          </p>
          <p className="flex items-center gap-2 text-foreground/75">
            <Clock className="h-4 w-4 shrink-0" />
            {isTraining ? `${event.startTime}–${event.endTime}` : event.time}
          </p>
          {!isTraining && (
            <p className="flex items-center gap-2 text-foreground/75">
              {event.isHome ? <Home className="h-4 w-4 shrink-0" /> : <Plane className="h-4 w-4 shrink-0" />}
              {event.isHome ? "Partita in casa" : "Partita in trasferta"}
            </p>
          )}
          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-primary hover:underline"
          >
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate">{event.location}</span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          </a>
          {event.notes && (
            <p className="whitespace-pre-line rounded-xl bg-surface-muted px-3.5 py-3 text-foreground/70">
              {event.notes}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
