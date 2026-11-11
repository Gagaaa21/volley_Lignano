import { Trophy } from "lucide-react";
import { CATEGORY_LABELS, categoryDotClass, trainingDotClass } from "@/lib/category";
import { cn } from "@/lib/cn";
import { CategoryTag } from "@/components/ui/CategoryTag";
import type { CalendarEvent, Category, TrainingColor } from "@/lib/types";

interface LegendEntry {
  key: string;
  label: string;
  dotClass?: string;
  /** Una partita di questa categoria: davanti c'è la stessa etichetta che sta sulle partite. */
  category?: Category;
  tournament?: boolean;
}

/** Le parole iniziali che più nomi hanno in comune, o «Allenamenti» se non ne hanno. */
export function commonLabel(titles: string[]): string {
  const words = titles.map((title) => title.trim().split(/\s+/));
  const common: string[] = [];
  for (let i = 0; i < words[0].length; i++) {
    const word = words[0][i];
    if (!words.every((list) => list[i]?.toLowerCase() === word.toLowerCase())) break;
    common.push(word);
  }
  return common.length > 0 ? common.join(" ") : "Allenamenti";
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
          category: event.category ?? undefined,
        });
      }
    }
  }

  const entries: LegendEntry[] = [];
  // Un colore con un solo tipo di allenamento porta il suo nome; con più nomi la parte che hanno in comune
  // («Allenamento», «Allenamento del sabato» → «Allenamento»), o «Allenamenti»: l'elenco tagliato con «…» non diceva niente.
  for (const [color, titles] of trainingTitlesByColor) {
    const list = [...titles];
    entries.push({ key: `training-${color}`, label: list.length === 1 ? list[0] : commonLabel(list), dotClass: trainingDotClass(color) });
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
          ) : entry.category ? (
            <CategoryTag category={entry.category} size="xs" />
          ) : (
            <span className={cn("h-2.5 w-2.5 rounded-full", entry.dotClass)} aria-hidden />
          )}
          {entry.label}
        </li>
      ))}
    </ul>
  );
}
