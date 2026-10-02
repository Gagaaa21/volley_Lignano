"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, ClipboardList, Clock, MapPin } from "lucide-react";
import { formatDateShort, formatWeekdays } from "@/lib/format";
import { cn } from "@/lib/cn";
import { trainingDotClass } from "@/lib/category";
import { Badge } from "@/components/ui/Badge";
import { SearchInput } from "@/components/ui/SearchInput";
import type { TrainingRule } from "@/lib/types";

/** Elenco regole allenamento con ricerca (mostrata solo oltre 5 regole,
 * stesso limite già usato per le atlete e le schede). Ogni riga apre la
 * pagina di modifica, dove si trova anche l'eliminazione. */
export function TrainingList({
  trainings,
  upcomingLinkedCountByRule,
}: {
  trainings: TrainingRule[];
  upcomingLinkedCountByRule: Record<string, number>;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return trainings;
    return trainings.filter(
      (t) => t.title.toLowerCase().includes(q) || t.location.toLowerCase().includes(q),
    );
  }, [trainings, query]);

  return (
    <div>
      {trainings.length > 5 && (
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca per titolo o luogo…"
          className="mb-4"
        />
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-surface/70 px-6 py-12 text-center text-sm text-muted-foreground">
          Nessun allenamento trovato per &quot;{query}&quot;.
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          {filtered.map((training) => {
            const linked = upcomingLinkedCountByRule[training.id] ?? 0;
            return (
              <Link
                key={training.id}
                href={`/admin/allenamenti/${training.id}`}
                className={cn(
                  "group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-surface-muted sm:px-5",
                  !training.isActive && "opacity-60",
                )}
              >
                <span className={cn("w-1 self-stretch rounded-full", trainingDotClass(training.color))} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="font-semibold text-foreground group-hover:text-primary">{training.title}</p>
                    {training.isTournament && <Badge tone="gold">Torneo</Badge>}
                    {!training.isActive && <Badge>Non attivo</Badge>}
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-muted-foreground">
                    <span className="font-semibold text-foreground/80">
                      {training.repeat === "once" ? formatDateShort(training.startDate) : formatWeekdays(training.weekdays)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      <span className="tabular">
                        {training.startTime}–{training.endTime}
                      </span>
                    </span>
                    <span className="inline-flex min-w-0 items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{training.location}</span>
                    </span>
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                    <span>
                      {training.repeat === "once"
                        ? "Singolo giorno"
                        : `Dal ${formatDateShort(training.startDate)}${
                            training.endDate ? ` al ${formatDateShort(training.endDate)}` : " · senza scadenza"
                          }`}
                    </span>
                    {linked > 0 && (
                      <span className="inline-flex items-center gap-1 font-semibold text-primary">
                        <ClipboardList className="h-3.5 w-3.5" />
                        {linked === 1 ? "1 data con scheda" : `${linked} date con scheda`}
                      </span>
                    )}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
