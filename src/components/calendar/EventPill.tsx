import { Dumbbell, Home, Plane, Trophy } from "lucide-react";
import { matchTitle } from "@/lib/calendar";
import { categoryBadgeClass, categoryLabel, trainingBadgeClass } from "@/lib/category";
import { cn } from "@/lib/cn";
import type { CalendarEvent } from "@/lib/types";

export function EventPill({ event, onSelect }: { event: CalendarEvent; onSelect?: () => void }) {
  const pillClass = cn(
    "flex w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-left text-[10px] font-semibold transition-opacity sm:text-[11px]",
    onSelect && "cursor-pointer hover:opacity-80",
  );

  if (event.kind === "training") {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={cn(pillClass, trainingBadgeClass(event.color))}
        title={`${event.startTime}–${event.endTime} · ${event.title} · ${event.location}`}
      >
        {event.isTournament ? (
          <Trophy className="h-2.5 w-2.5 shrink-0" />
        ) : (
          <Dumbbell className="h-2.5 w-2.5 shrink-0" />
        )}
        <span className="truncate">
          {event.startTime} {event.isTournament ? "Torneo" : "Allenamento"}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(pillClass, categoryBadgeClass(event.category))}
      title={`${event.time} · ${categoryLabel(event.category)} ${event.isHome ? "in casa" : "in trasferta"} · ${matchTitle(event)} · ${event.location}`}
    >
      {event.isHome ? (
        <Home className="h-2.5 w-2.5 shrink-0" />
      ) : (
        <Plane className="h-2.5 w-2.5 shrink-0" />
      )}
      <span className="truncate">
        {event.time} {event.category ? `${event.category} · ` : ""}{event.opponent}
      </span>
    </button>
  );
}
