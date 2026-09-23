"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import {
  Calendar,
  CalendarPlus,
  Check,
  Clock,
  Dumbbell,
  ExternalLink,
  Home,
  MapPin,
  Plane,
  Puzzle,
  Share2,
  Swords,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { CATEGORY_BADGE, CATEGORY_LABELS, TRAINING_BADGE } from "@/lib/category";
import { cn } from "@/lib/cn";
import { BlockContent } from "@/components/schede/BlockContent";
import { buildICSSingleEvent, eventTitle } from "@/lib/ics";
import type { CalendarEvent } from "@/lib/types";
import type { PublicAttendanceRecord } from "@/lib/publicCalendarData";

export interface EventPlan {
  title: string;
  blocks: { id: string; title: string; durationMinutes: number; content: string }[];
}

export interface EventAttendance {
  records: PublicAttendanceRecord[];
}

export interface EventCallUps {
  names: string[];
}

const ATTENDANCE_LABEL: Record<PublicAttendanceRecord["status"], string> = {
  present: "Presente",
  excused: "Assente (giustificata)",
  unexcused: "Assente",
};

const ATTENDANCE_CLASS: Record<PublicAttendanceRecord["status"], string> = {
  present: "bg-[var(--color-training-soft)] text-[var(--color-training-strong)]",
  excused: "bg-sand-100 text-sand-800",
  unexcused: "bg-destructive/10 text-destructive",
};

function eventShareText(event: CalendarEvent): string {
  const dateLabel = format(parseISO(event.date), "EEEE d MMMM", { locale: it });
  const time = event.kind === "training" ? `${event.startTime}–${event.endTime}` : event.time;
  return `${eventTitle(event)} — ${dateLabel} alle ${time} · ${event.location}`;
}

function downloadICS(event: CalendarEvent) {
  const blob = new Blob([buildICSSingleEvent(event)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${eventTitle(event).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function EventActions({ event }: { event: CalendarEvent }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const text = eventShareText(event);
    const url = window.location.origin;
    if (navigator.share) {
      try {
        await navigator.share({ title: eventTitle(event), text, url });
      } catch {
        // Annullata dall'utente: nessuna azione.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text} · ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard non disponibile: nessuna azione bloccante.
    }
  }

  const actionClass =
    "flex flex-1 items-center justify-center gap-2 rounded-xl border border-border-subtle bg-surface px-3.5 py-2.5 text-sm font-semibold text-foreground/75 transition-colors hover:border-primary/25 hover:bg-primary/[0.03] hover:text-foreground";

  return (
    <div className="mt-4 flex gap-2 border-t border-border-subtle pt-4">
      <button type="button" onClick={() => downloadICS(event)} className={actionClass}>
        <CalendarPlus className="h-4 w-4" />
        Calendario
      </button>
      <button type="button" onClick={handleShare} className={actionClass}>
        {copied ? <Check className="h-4 w-4 text-primary" /> : <Share2 className="h-4 w-4" />}
        {copied ? "Copiato" : "Condividi"}
      </button>
    </div>
  );
}

export function EventDetailDialog({
  event,
  plan,
  attendance,
  callUps,
  onClose,
}: {
  event: CalendarEvent | null;
  plan?: EventPlan;
  attendance?: EventAttendance;
  callUps?: EventCallUps;
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
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-border-subtle bg-surface p-5 shadow-[0_-20px_50px_-20px_rgba(9,27,38,0.35)] sm:rounded-2xl sm:p-6 sm:shadow-[0_20px_50px_-20px_rgba(9,27,38,0.35)]"
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
              <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                    badgeClass,
                  )}
                >
                  {isTraining ? "U14 · U15" : CATEGORY_LABELS[event.category]}
                </span>
                {!isTraining && event.isFriendly && (
                  <span className="inline-flex rounded-full bg-foreground/8 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-foreground/55">
                    Amichevole
                  </span>
                )}
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

        <div className="mt-4 space-y-2.5 rounded-2xl border border-border-subtle bg-surface-muted/50 p-4 text-sm">
          <p className="flex items-center gap-2.5 font-medium capitalize text-foreground">
            <Calendar className="h-4 w-4 shrink-0 text-foreground/45" />
            {format(dateObj, "EEEE d MMMM yyyy", { locale: it })}
          </p>
          <p className="flex items-center gap-2.5 text-foreground/75">
            <Clock className="h-4 w-4 shrink-0 text-foreground/45" />
            {isTraining ? `${event.startTime}–${event.endTime}` : event.time}
          </p>
          {!isTraining && (
            <p className="flex items-center gap-2.5 text-foreground/75">
              {event.isHome ? (
                <Home className="h-4 w-4 shrink-0 text-foreground/45" />
              ) : (
                <Plane className="h-4 w-4 shrink-0 text-foreground/45" />
              )}
              {event.isHome ? "Partita in casa" : "Partita in trasferta"}
            </p>
          )}
          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 text-primary hover:underline"
          >
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate">{event.location}</span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          </a>
          {!isTraining && (event.meetingTime || event.meetingLocation) && (
            <p className="flex items-start gap-2.5 border-t border-border-subtle pt-2.5 text-foreground/75">
              <Users className="mt-0.5 h-4 w-4 shrink-0 text-foreground/45" />
              <span>
                Ritrovo{event.meetingTime ? ` alle ${event.meetingTime}` : ""}
                {event.meetingLocation ? ` · ${event.meetingLocation}` : ""}
              </span>
            </p>
          )}
        </div>

        {!isTraining && event.resultSetsWon !== null && event.resultSetsLost !== null && (
          <div className="mt-4 rounded-2xl border border-border-subtle p-4">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "icon-chip",
                  event.resultSetsWon > event.resultSetsLost
                    ? "bg-[linear-gradient(135deg,var(--color-u14),var(--color-u14-strong))]"
                    : "bg-[linear-gradient(135deg,var(--destructive),var(--destructive-strong))]",
                )}
              >
                <Trophy className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-sea-700">Risultato finale</p>
                <p className="text-sm font-bold text-foreground">
                  {event.resultSetsWon > event.resultSetsLost ? "Vittoria" : "Sconfitta"}{" "}
                  {event.resultSetsWon}-{event.resultSetsLost}
                </p>
              </div>
            </div>
            {event.setScores && event.setScores.length > 0 && (
              <p className="mt-3 flex flex-wrap gap-1.5">
                {event.setScores.map((s, i) => (
                  <span
                    key={i}
                    className="rounded-lg bg-surface-muted px-2 py-1 text-xs font-semibold text-foreground/70"
                  >
                    {s.us}-{s.them}
                  </span>
                ))}
              </p>
            )}
          </div>
        )}

        {!isTraining && callUps && callUps.names.length > 0 && (
          <div className="mt-4 rounded-2xl border border-border-subtle p-4">
            <div className="flex items-center gap-3">
              <span className="icon-chip">
                <Users className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-sea-700">Convocate</p>
                <p className="text-sm font-bold text-foreground">{callUps.names.length} convocate</p>
              </div>
            </div>
            <div className="mt-3.5 flex flex-wrap gap-1.5">
              {callUps.names.map((name) => (
                <span
                  key={name}
                  className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-foreground/75"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {event.notes && (
          <p className="mt-3 whitespace-pre-line rounded-2xl bg-surface-muted px-4 py-3 text-sm text-foreground/70">
            {event.notes}
          </p>
        )}

        {isTraining && plan && (
          <div className="mt-4 rounded-2xl border border-border-subtle p-4">
            <div className="flex items-center gap-3">
              <span className="icon-chip">
                <Puzzle className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-sea-700">Cosa si fa</p>
                <p className="truncate text-sm font-bold text-foreground">{plan.title}</p>
              </div>
            </div>
            <ol className="mt-3.5 space-y-3">
              {plan.blocks.map((block, index) => (
                <li key={block.id} className="rounded-xl border border-border-subtle bg-surface-muted/60 px-3.5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-foreground">
                      {index + 1}. {block.title}
                    </p>
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--color-training-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-training-strong)]">
                      <Clock className="h-2.5 w-2.5" />
                      {block.durationMinutes}&apos;
                    </span>
                  </div>
                  <BlockContent content={block.content} className="mt-2" />
                </li>
              ))}
            </ol>
          </div>
        )}

        {isTraining && attendance && attendance.records.length > 0 && (
          <div className="mt-4 rounded-2xl border border-border-subtle p-4">
            <div className="flex items-center gap-3">
              <span className="icon-chip">
                <Users className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-sea-700">Presenze</p>
                <p className="text-sm font-bold text-foreground">
                  {attendance.records.filter((r) => r.status === "present").length}/
                  {attendance.records.length} presenti
                </p>
              </div>
            </div>
            <ul className="mt-3.5 space-y-1.5">
              {attendance.records.map((record) => (
                <li
                  key={record.fullName}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface-muted/60 px-3.5 py-2.5"
                >
                  <span className="min-w-0 truncate text-sm font-medium text-foreground">
                    {record.fullName}
                  </span>
                  <span
                    className={cn(
                      "flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                      ATTENDANCE_CLASS[record.status],
                    )}
                  >
                    {record.status === "present" && <Check className="h-2.5 w-2.5" />}
                    {ATTENDANCE_LABEL[record.status]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <EventActions event={event} />
      </div>
    </div>
  );
}
