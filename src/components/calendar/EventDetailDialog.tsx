"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import type { ReactNode } from "react";
import {
  Calendar,
  CalendarPlus,
  Check,
  Clock,
  ExternalLink,
  Home,
  MapPin,
  Plane,
  Share2,
  Users,
  X,
} from "lucide-react";
import { CATEGORY_LABELS, categoryDotClass, MATCH_NO_CATEGORY_LABEL, trainingDotClass } from "@/lib/category";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/components/ui/button-variants";
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
  present: "bg-success-soft text-success",
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

  return (
    <div className="sticky bottom-0 flex gap-2 border-t border-border bg-card/95 px-5 py-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={() => downloadICS(event)}
        className={buttonVariants({ variant: "outline", className: "flex-1" })}
      >
        <CalendarPlus className="h-4 w-4" />
        Aggiungi al calendario
      </button>
      <button type="button" onClick={handleShare} className={buttonVariants({ variant: "outline", className: "flex-1" })}>
        {copied ? <Check className="h-4 w-4 text-success" /> : <Share2 className="h-4 w-4" />}
        {copied ? "Copiato" : "Condividi"}
      </button>
    </div>
  );
}

function Fact({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground [&_svg]:h-[18px] [&_svg]:w-[18px]">
        {icon}
      </span>
      <div className="min-w-0 flex-1 text-[15px] text-foreground">{children}</div>
    </div>
  );
}

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-t border-border px-5 py-5 sm:px-6">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">{title}</h3>
        {aside && <span className="text-[13px] font-semibold text-foreground/70">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

function SetScores({ scores }: { scores: { us: number; them: number }[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {scores.map((s, i) => (
        <span
          key={i}
          className={cn(
            "tabular rounded-lg px-2 py-1 text-xs font-semibold",
            s.us > s.them ? "bg-success-soft text-success" : "bg-muted text-foreground/70",
          )}
        >
          {s.us}–{s.them}
        </span>
      ))}
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
  const dotClass = isTraining ? trainingDotClass(event.color) : categoryDotClass(event.category);
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`;
  const kind = isTraining
    ? event.isTournament
      ? "Torneo"
      : "Allenamento"
    : event.isTournament
      ? "Torneo"
      : "Partita";
  const hasResult = !isTraining && !event.isTournament && event.resultSetsWon !== null && event.resultSetsLost !== null;
  const won = hasResult && event.resultSetsWon! > event.resultSetsLost!;

  // Portale su <body>: il dialog può essere aperto da dentro contenitori
  // con un proprio contesto di sovrapposizione (es. l'hero, z-10), che
  // altrimenti lo lascerebbero sotto l'header sticky.
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-[rgba(12,29,54,0.45)] backdrop-blur-[3px] sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg animate-[pop-in_180ms_ease-out] flex-col overflow-hidden rounded-t-3xl bg-card shadow-pop sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Dettagli evento"
      >
        <div className="overflow-y-auto">
          <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-border-strong sm:hidden" aria-hidden />

          <div className="px-5 pb-5 pt-4 sm:px-6 sm:pt-6">
            <div className="flex items-start justify-between gap-3">
              <p className="flex items-center gap-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
                <span className={cn("h-2.5 w-2.5 rounded-full", dotClass)} aria-hidden />
                {kind}
                {!isTraining && <> · {event.category ? CATEGORY_LABELS[event.category] : MATCH_NO_CATEGORY_LABEL}</>}
              </p>
              <button
                type="button"
                onClick={onClose}
                aria-label="Chiudi"
                className="-mr-1.5 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <h2 className="display-wide mt-1 text-[1.625rem] leading-tight text-foreground">{eventTitle(event)}</h2>
            {!isTraining && event.isFriendly && (
              <span className="mt-2.5 inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                Amichevole
              </span>
            )}

            <div className="mt-5 space-y-3">
              <Fact icon={<Calendar />}>
                <span className="block font-semibold first-letter:uppercase">{format(dateObj, "EEEE d MMMM yyyy", { locale: it })}</span>
              </Fact>
              <Fact icon={<Clock />}>
                <span className="tabular">{isTraining ? `${event.startTime}–${event.endTime}` : event.time}</span>
                {!isTraining && (event.meetingTime || event.meetingLocation) && (
                  <span className="block text-[13px] text-muted-foreground">
                    Ritrovo{event.meetingTime ? ` alle ${event.meetingTime}` : ""}
                    {event.meetingLocation ? ` · ${event.meetingLocation}` : ""}
                  </span>
                )}
              </Fact>
              {!isTraining && (
                <Fact icon={event.isHome ? <Home /> : <Plane />}>
                  {event.isHome ? "Partita in casa" : "Partita in trasferta"}
                </Fact>
              )}
              <Fact icon={<MapPin />}>
                <a
                  href={mapsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex max-w-full items-center gap-1.5 font-medium text-primary"
                >
                  <span className="truncate group-hover:underline">{event.location}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                </a>
              </Fact>
            </div>
          </div>

          {hasResult && (
            <Section title="Risultato finale">
              <div className="flex items-center gap-4">
                <p
                  className={cn(
                    "display-wide tabular text-[2.5rem] leading-none",
                    won ? "text-success" : "text-foreground/80",
                  )}
                >
                  {event.resultSetsWon}–{event.resultSetsLost}
                </p>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-bold",
                    won ? "bg-success-soft text-success" : "bg-destructive/10 text-destructive",
                  )}
                >
                  {won ? "Vittoria" : "Sconfitta"}
                </span>
              </div>
              {event.setScores && event.setScores.length > 0 && (
                <div className="mt-3">
                  <SetScores scores={event.setScores} />
                </div>
              )}
            </Section>
          )}

          {!isTraining &&
            event.isTournament &&
            event.tournamentGames &&
            event.tournamentGames.some((g) => g.setScores.length > 0) && (
              <Section title="Risultati del torneo">
                <div className="space-y-3">
                  {event.tournamentGames
                    .filter((g) => g.setScores.length > 0)
                    .map((g) => (
                      <div key={g.id} className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">vs {g.opponent}</p>
                        <SetScores scores={g.setScores} />
                      </div>
                    ))}
                </div>
              </Section>
            )}

          {!isTraining && callUps && callUps.names.length > 0 && (
            <Section title="Convocate" aside={callUps.names.length}>
              <div className="flex flex-wrap gap-1.5">
                {callUps.names.map((name) => (
                  <span key={name} className="rounded-full bg-muted px-3 py-1 text-[13px] font-medium text-foreground/80">
                    {name}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {event.notes && (
            <Section title="Note">
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/80">{event.notes}</p>
            </Section>
          )}

          {isTraining && plan && (
            <Section title="Cosa si fa" aside={plan.title}>
              <ol className="space-y-2.5">
                {plan.blocks.map((block, index) => (
                  <li key={block.id} className="rounded-2xl border border-border bg-surface-muted px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-foreground">
                        <span className="tabular mr-1.5 text-muted-foreground">{index + 1}.</span>
                        {block.title}
                      </p>
                      <span className="tabular flex shrink-0 items-center gap-1 rounded-full bg-card px-2 py-0.5 text-[11px] font-bold text-foreground/70 ring-1 ring-border">
                        <Clock className="h-3 w-3" />
                        {block.durationMinutes}&apos;
                      </span>
                    </div>
                    <BlockContent content={block.content} className="mt-2" />
                  </li>
                ))}
              </ol>
            </Section>
          )}

          {isTraining && attendance && attendance.records.length > 0 && (() => {
            // Il Minivolley non registra le assenze (vedi MiniAttendanceForm),
            // quindi ogni voce è per forza presente: qui non si distingue dal
            // caso (raro) in cui, in U14/U15, erano davvero presenti tutte —
            // in entrambi i casi il testo "N/N presenti" e il badge ripetuto
            // su ogni riga sarebbero solo rumore.
            const allPresent = attendance.records.every((r) => r.status === "present");
            const presentCount = attendance.records.filter((r) => r.status === "present").length;
            return (
              <Section
                title="Presenze"
                aside={
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {allPresent ? `${attendance.records.length} presenti` : `${presentCount}/${attendance.records.length} presenti`}
                  </span>
                }
              >
                <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
                  {attendance.records.map((record) => (
                    <li key={record.fullName} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <span className="min-w-0 truncate text-sm font-medium text-foreground">{record.fullName}</span>
                      {!allPresent && (
                        <span
                          className={cn(
                            "flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                            ATTENDANCE_CLASS[record.status],
                          )}
                        >
                          {record.status === "present" && <Check className="h-3 w-3" />}
                          {ATTENDANCE_LABEL[record.status]}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </Section>
            );
          })()}
        </div>

        <EventActions event={event} />
      </div>
    </div>,
    document.body,
  );
}
