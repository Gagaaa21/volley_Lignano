"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Clock, MapPin, Pencil, Puzzle, Search } from "lucide-react";
import { formatDateShort, formatWeekdays } from "@/lib/format";
import { cn } from "@/lib/cn";
import { trainingDotClass } from "@/lib/category";
import { Card, CardBody } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import { Badge } from "@/components/ui/Badge";
import { ConfirmSubmitButton } from "@/components/forms/ConfirmSubmitButton";
import type { TrainingRule } from "@/lib/types";
import { deleteTrainingAction } from "../actions";

/** Elenco regole allenamento con ricerca (mostrata solo oltre 5 regole,
 * stesso limite già usato per le atlete e le schede). */
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
        <div className="relative mt-5 max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/35" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca per titolo o luogo…"
            className="w-full rounded-full border border-border-subtle bg-surface py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-foreground/35 focus:border-primary/40 focus:outline-none"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border-subtle bg-surface px-6 py-12 text-center text-sm text-foreground/50">
          Nessun allenamento trovato per &quot;{query}&quot;.
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {filtered.map((training) => (
            <Card key={training.id}>
              <CardBody className="pt-5">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="flex min-w-0 items-center gap-2 font-display text-base font-bold text-foreground">
                    <span
                      className={cn("h-2.5 w-2.5 shrink-0 rounded-full", trainingDotClass(training.color))}
                      aria-hidden
                    />
                    <span className="truncate">{training.title}</span>
                  </h2>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {training.isTournament && (
                      <Badge className="bg-foreground/8 text-foreground/60">Torneo</Badge>
                    )}
                    <Badge
                      className={
                        training.isActive
                          ? "bg-[var(--color-u14-soft)] text-[var(--color-u14-strong)]"
                          : "bg-foreground/10 text-foreground/50"
                      }
                    >
                      {training.isActive ? "Attivo" : "Non attivo"}
                    </Badge>
                  </div>
                </div>

                <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-sea-700">
                  {training.repeat === "once" ? (
                    <>
                      <CalendarDays className="h-3.5 w-3.5" />
                      Singolo giorno
                    </>
                  ) : (
                    formatWeekdays(training.weekdays)
                  )}
                </p>

                <div className="mt-2 space-y-1.5 text-sm text-foreground/65">
                  <p className="flex items-center gap-2">
                    <Clock className="h-4 w-4 shrink-0" />
                    {training.startTime}–{training.endTime}
                  </p>
                  <p className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span className="truncate">{training.location}</span>
                  </p>
                </div>

                <p className="mt-3 text-xs text-foreground/45">
                  {training.repeat === "once"
                    ? `Il ${formatDateShort(training.startDate)}`
                    : `Dal ${formatDateShort(training.startDate)}${
                        training.endDate ? ` al ${formatDateShort(training.endDate)}` : " · senza scadenza"
                      }`}
                </p>

                {(upcomingLinkedCountByRule[training.id] ?? 0) > 0 && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <Puzzle className="h-3.5 w-3.5" />
                    {upcomingLinkedCountByRule[training.id] === 1
                      ? "1 prossima data con scheda collegata"
                      : `${upcomingLinkedCountByRule[training.id]} prossime date con scheda collegata`}
                  </p>
                )}

                <div className="mt-4 flex items-center gap-2 border-t border-border-subtle pt-4">
                  <LinkButton
                    href={`/admin/allenamenti/${training.id}`}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Modifica
                  </LinkButton>
                  <form action={deleteTrainingAction}>
                    <input type="hidden" name="id" value={training.id} />
                    <ConfirmSubmitButton
                      confirmMessage={`Eliminare l'allenamento "${training.title}" (${
                        training.repeat === "once"
                          ? formatDateShort(training.startDate)
                          : formatWeekdays(training.weekdays)
                      })?`}
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/8"
                    >
                      Elimina
                    </ConfirmSubmitButton>
                  </form>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
