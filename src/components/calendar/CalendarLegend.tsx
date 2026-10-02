import { Trophy } from "lucide-react";
import { CATEGORY_LABELS, categoryDotClass, trainingDotClass } from "@/lib/category";
import { cn } from "@/lib/cn";
import type { CalendarEvent, TrainingColor } from "@/lib/types";

interface LegendEntry {
  key: string;
  label: string;
  dotClass?: string;
  tournament?: boolean;
}

/** Legenda costruita dagli eventi davvero mostrati: un colore per ogni tipo
 * di allenamento presente (con il suo nome reale, es. "Preparazione
 * fisica"), più le partite per categoria e i tornei. Così non descrive mai
 * colori che sul calendario non compaiono. */
function buildEntries(events: CalendarEvent[]): LegendEntry[] {
  const trainingTitlesByColor = new Map<TrainingColor, Set<string>>();
  const matchKeys = new Map<string, LegendEntry>();
  let hasTournament = false;

  for (const event of events) {
    if (event.kind === "training") {
      if (event.isTournament) {
        hasTournament = true;
        continue;
      }
      const titles = trainingTitlesByColor.get(event.color) ?? new Set<string>();
      titles.add(event.title);
      trainingTitlesByColor.set(event.color, titles);
    } else {
      const key = event.category ?? "none";
      if (!matchKeys.has(key)) {
        matchKeys.set(key, {
          key: `match-${key}`,
          label: event.category ? `Partita ${CATEGORY_LABELS[event.category]}` : "Partita",
          dotClass: categoryDotClass(event.category),
        });
      }
    }
  }

  const entries: LegendEntry[] = [];
  for (const [color, titles] of trainingTitlesByColor) {
    const list = [...titles];
    entries.push({
      key: `training-${color}`,
      label: list.length > 2 ? `${list.slice(0, 2).join(", ")}…` : list.join(", "),
      dotClass: trainingDotClass(color),
    });
  }
  entries.push(...[...matchKeys.values()].sort((a, b) => a.label.localeCompare(b.label)));
  if (hasTournament) entries.push({ key: "tournament", label: "Torneo", tournament: true });
  return entries;
}

export function CalendarLegend({ events, className }: { events: CalendarEvent[]; className?: string }) {
  const entries = buildEntries(events);
  if (entries.length === 0) return null;

  return (
    <ul className={cn("flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-muted-foreground", className)}>
      {entries.map((entry) => (
        <li key={entry.key} className="inline-flex items-center gap-2">
          {entry.tournament ? (
            <Trophy className="h-3.5 w-3.5 text-sand-600" />
          ) : (
            <span className={cn("h-2.5 w-2.5 rounded-full", entry.dotClass)} aria-hidden />
          )}
          {entry.label}
        </li>
      ))}
    </ul>
  );
}
