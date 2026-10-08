import { Trophy } from "lucide-react";
import { matchTitle } from "@/lib/calendar";
import { categoryBadgeClass, categoryDotClass, categoryLabel, trainingDotClass } from "@/lib/category";
import { cn } from "@/lib/cn";
import type { CalendarEvent } from "@/lib/types";

/**
 * Evento dentro una cella del calendario mensile. Gerarchia voluta: gli
 * allenamenti (la routine) sono una riga leggera — pallino colorato, ora,
 * titolo — mentre partite e tornei (gli eventi speciali) sono una pastiglia
 * piena nel colore della categoria, così saltano all'occhio.
 */
export function EventPill({ event, onSelect }: { event: CalendarEvent; onSelect?: () => void }) {
  const base =
    "group flex w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 py-[3px] text-left text-[11.5px] leading-4 transition-colors";

  if (event.kind === "training") {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          base,
          event.isTournament
            ? "bg-sand-100 font-semibold text-sand-800 hover:bg-sand-200/70"
            : "text-foreground/85 hover:bg-muted",
        )}
        title={`${event.startTime}–${event.endTime} · ${event.title} · ${event.location}${
          event.usual ? " (cambiato solo per questo giorno)" : ""
        }`}
      >
        {event.isTournament ? (
          <Trophy className="h-3 w-3 shrink-0" />
        ) : (
          <span className={cn("h-2 w-2 shrink-0 rounded-full", trainingDotClass(event.color))} aria-hidden />
        )}
        <span className="tabular shrink-0 font-semibold text-foreground">{event.startTime}</span>
        <span className="truncate">{event.title}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(base, "font-semibold hover:brightness-[0.97]", categoryBadgeClass(event.category))}
      title={`${event.time} · ${categoryLabel(event.category)} ${event.isHome ? "in casa" : "in trasferta"} · ${matchTitle(event)} · ${event.location}`}
    >
      {event.isTournament ? (
        <Trophy className="h-3 w-3 shrink-0" />
      ) : (
        <span className={cn("h-2 w-2 shrink-0 rounded-full", categoryDotClass(event.category))} aria-hidden />
      )}
      <span className="tabular shrink-0">{event.time}</span>
      <span className="truncate">{event.opponent}</span>
    </button>
  );
}
