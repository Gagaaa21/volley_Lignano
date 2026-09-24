import { Dumbbell, Home, Plane } from "lucide-react";
import { matchTitle } from "@/lib/calendar";
import { CATEGORY_BADGE, TRAINING_BADGE } from "@/lib/category";
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
        className={cn(pillClass, TRAINING_BADGE)}
        title={`${event.startTime}–${event.endTime} · ${event.title} · ${event.location}`}
      >
        <Dumbbell className="h-2.5 w-2.5 shrink-0" />
        <span className="truncate">{event.startTime} Allenamento</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(pillClass, CATEGORY_BADGE[event.category])}
      title={`${event.time} · ${event.category} ${event.isHome ? "in casa" : "in trasferta"} · ${matchTitle(event)} · ${event.location}`}
    >
      {event.isHome ? (
        <Home className="h-2.5 w-2.5 shrink-0" />
      ) : (
        <Plane className="h-2.5 w-2.5 shrink-0" />
      )}
      <span className="truncate">
        {event.time} {event.category} · {event.opponent}
      </span>
    </button>
  );
}
