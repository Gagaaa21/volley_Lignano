import { Dumbbell, Home, Plane } from "lucide-react";
import { CATEGORY_BADGE, TRAINING_BADGE } from "@/lib/category";
import { cn } from "@/lib/cn";
import type { CalendarEvent } from "@/lib/types";

export function EventPill({ event }: { event: CalendarEvent }) {
  if (event.kind === "training") {
    return (
      <span
        className={cn(
          "flex items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[10px] font-semibold sm:text-[11px]",
          TRAINING_BADGE,
        )}
        title={`${event.startTime}–${event.endTime} · ${event.title} · ${event.location}`}
      >
        <Dumbbell className="h-2.5 w-2.5 shrink-0" />
        <span className="truncate">{event.startTime} Allenamento</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[10px] font-semibold sm:text-[11px]",
        CATEGORY_BADGE[event.category],
      )}
      title={`${event.time} · ${event.category} ${event.isHome ? "in casa" : "in trasferta"} vs ${event.opponent} · ${event.location}`}
    >
      {event.isHome ? (
        <Home className="h-2.5 w-2.5 shrink-0" />
      ) : (
        <Plane className="h-2.5 w-2.5 shrink-0" />
      )}
      <span className="truncate">
        {event.time} {event.category} · {event.opponent}
      </span>
    </span>
  );
}
