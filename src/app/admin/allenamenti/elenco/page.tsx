import type { Metadata } from "next";
import { format } from "date-fns";
import { ArrowLeft, CalendarDays, Clock, MapPin, Pencil, Plus, Puzzle } from "lucide-react";
import { getRepo } from "@/lib/db";
import { formatDateShort, formatWeekdays } from "@/lib/format";
import { Card, CardBody } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import { Badge } from "@/components/ui/Badge";
import { ConfirmSubmitButton } from "@/components/forms/ConfirmSubmitButton";
import { deleteTrainingAction } from "../actions";

export const metadata: Metadata = {
  title: "Elenco allenamenti",
};

export default async function TrainingsListPage() {
  const repo = await getRepo();
  const [trainings, occurrencePlans] = await Promise.all([
    repo.listTrainings(),
    repo.listTrainingOccurrencePlans(),
  ]);
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const upcomingLinkedCountByRule = new Map<string, number>();
  for (const o of occurrencePlans) {
    if (o.occurrenceDate < todayStr) continue;
    upcomingLinkedCountByRule.set(o.trainingRuleId, (upcomingLinkedCountByRule.get(o.trainingRuleId) ?? 0) + 1);
  }

  return (
    <div>
      <LinkButton href="/admin/allenamenti" variant="ghost" size="sm" className="mb-4 -ml-3.5">
        <ArrowLeft className="h-4 w-4" />
        Torna al calendario
      </LinkButton>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Elenco regole</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Orari ricorrenti e singoli giorni: giorni della settimana, orario e luogo di ogni allenamento.
          </p>
        </div>
        <LinkButton href="/admin/allenamenti/nuovo">
          <Plus className="h-4 w-4" />
          Nuovo allenamento
        </LinkButton>
      </div>

      {trainings.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border-subtle bg-surface px-6 py-12 text-center text-sm text-foreground/50">
          Nessun allenamento configurato. Creane uno per farlo comparire nel calendario pubblico.
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {trainings.map((training) => (
            <Card key={training.id}>
              <CardBody className="pt-5">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-display text-base font-bold text-foreground">{training.title}</h2>
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

                {(upcomingLinkedCountByRule.get(training.id) ?? 0) > 0 && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <Puzzle className="h-3.5 w-3.5" />
                    {upcomingLinkedCountByRule.get(training.id) === 1
                      ? "1 prossima data con scheda collegata"
                      : `${upcomingLinkedCountByRule.get(training.id)} prossime date con scheda collegata`}
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
                      className="text-red-600 hover:bg-red-50"
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
