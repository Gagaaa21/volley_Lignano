import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addDays, format } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarOff, ChevronRight, ClipboardList, Globe, RotateCcw, Trash2 } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { expandTrainings, occurrenceKey } from "@/lib/calendar";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { PageHeader, SectionHeading } from "@/components/ui/PageHeader";
import { formatDateShort, formatWeekdays } from "@/lib/format";
import { ConfirmSubmitButton } from "@/components/forms/ConfirmSubmitButton";
import { cn } from "@/lib/cn";
import { TrainingForm } from "../TrainingForm";
import { deleteTrainingAction, restoreTrainingOccurrenceAction, skipTrainingOccurrenceAction } from "../actions";

export const metadata: Metadata = {
  title: "Modifica allenamento",
};

const MAX_OCCURRENCES_PREVIEW = 5;

export default async function EditTrainingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = await getActiveRepo();
  const training = await repo.getTraining(id);
  if (!training) notFound();
  // Solo schede della stessa squadra dell'allenamento.
  const [allPlans, occurrencePlans] = await Promise.all([
    repo.listTrainingPlans({ team: training.team }),
    repo.listTrainingOccurrencePlans(),
  ]);

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const rangeStart = training.repeat === "once" ? new Date(`${training.startDate}T00:00:00`) : today;
  const rangeEnd = training.repeat === "once" ? rangeStart : addDays(today, 90);
  const allOccurrences = expandTrainings([training], rangeStart, rangeEnd);
  const occurrences = allOccurrences.slice(0, MAX_OCCURRENCES_PREVIEW);
  const remainingCount = allOccurrences.length - occurrences.length;
  const upcomingExcludedDates = training.excludedDates.filter((d) => d >= todayStr).sort();

  const occurrencePlanByKey = new Map(
    occurrencePlans
      .filter((o) => o.trainingRuleId === id)
      .map((o) => [occurrenceKey(o.trainingRuleId, o.occurrenceDate), o] as const),
  );
  const planById = new Map(allPlans.map((p) => [p.id, p] as const));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={{ href: "/admin/allenamenti/elenco", label: "Elenco regole" }}
        eyebrow={training.isTournament ? "Torneo" : "Allenamento"}
        title={training.title}
        description={
          training.repeat === "once"
            ? `${formatDateShort(training.startDate)} · ${training.startTime}–${training.endTime}`
            : `${formatWeekdays(training.weekdays)} · ${training.startTime}–${training.endTime}`
        }
      />

      <Card>
        <CardBody className="pt-6 sm:pt-7">
          <TrainingForm training={training} allowTournament={training.team === "minivolley"} />
        </CardBody>
      </Card>

      <section className="mt-10">
        <SectionHeading
          title={training.repeat === "once" ? "Scheda" : "Prossime date"}
          description={
            training.repeat === "once"
              ? "Collega una scheda a questo allenamento e scegli se mostrarla nel calendario pubblico."
              : "Apri una data per collegarle una scheda o cambiarne orario e luogo solo per quel giorno."
          }
        />
        {occurrences.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border-strong px-5 py-6 text-center text-sm text-muted-foreground">
            Nessuna data programmata nei prossimi 90 giorni.
          </p>
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            {occurrences.map((occ) => {
              const occurrencePlan = occurrencePlanByKey.get(occurrenceKey(id, occ.date));
              const currentPlan = occurrencePlan ? planById.get(occurrencePlan.planId) : null;
              const occDateLabel = format(new Date(`${occ.date}T00:00:00`), "EEEE d MMMM", { locale: it });

              return (
                <div key={occ.date} className="flex items-center gap-1 pr-2">
                  <Link
                    href={`/admin/allenamenti/scheda/${id}/${occ.date}`}
                    className="group flex min-w-0 flex-1 items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-muted sm:px-5"
                  >
                    <span className="w-24 shrink-0 text-sm font-semibold text-foreground first-letter:uppercase">
                      {format(new Date(`${occ.date}T00:00:00`), "EEE d MMM", { locale: it })}
                    </span>
                    <span
                      className={cn(
                        "flex min-w-0 flex-1 items-center gap-1.5 text-sm",
                        currentPlan ? "font-semibold text-primary" : "text-muted-foreground",
                      )}
                    >
                      {occ.kind === "training" && occ.usual && (
                        <span
                          className="max-w-[55%] shrink-0 truncate rounded-full bg-warning-soft px-2 py-px text-[11px] font-semibold text-warning"
                          title="Cambiato solo per questo giorno"
                        >
                          {occ.startTime}–{occ.endTime} · {occ.location}
                        </span>
                      )}
                      <ClipboardList className="h-4 w-4 shrink-0" />
                      <span className="truncate">{currentPlan ? currentPlan.title : "Nessuna scheda"}</span>
                      {currentPlan && occurrencePlan?.isPublic && (
                        <Globe className="h-3.5 w-3.5 shrink-0" aria-label="Visibile al pubblico" />
                      )}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                  </Link>
                  {training.repeat !== "once" && (
                    <form action={skipTrainingOccurrenceAction}>
                      <input type="hidden" name="ruleId" value={id} />
                      <input type="hidden" name="date" value={occ.date} />
                      <ConfirmSubmitButton
                        confirmMessage={`Saltare l'allenamento di ${occDateLabel}? Le altre date della serie restano invariate; puoi ripristinarla in qualsiasi momento.`}
                        variant="quiet"
                        size="icon-sm"
                        aria-label="Salta questa data"
                        title="Salta questa data"
                        className="hover:bg-destructive/8 hover:text-destructive"
                      >
                        <CalendarOff className="h-4 w-4" />
                      </ConfirmSubmitButton>
                    </form>
                  )}
                </div>
              );
            })}
            {remainingCount > 0 && (
              <Link
                href="/admin/allenamenti"
                className="block px-4 py-2.5 text-center text-[13px] font-semibold text-primary hover:bg-surface-muted"
              >
                +{remainingCount} altre date nei prossimi 90 giorni · calendario completo
              </Link>
            )}
          </div>
        )}
      </section>

      {training.repeat !== "once" && upcomingExcludedDates.length > 0 && (
        <section className="mt-10">
          <SectionHeading
            title="Date saltate"
            description="Non compaiono nel calendario né vanno registrate come presenze per questa serie."
          />
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            {upcomingExcludedDates.map((date) => (
              <div key={date} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                <span className="text-sm font-semibold text-muted-foreground line-through decoration-muted-foreground/40 first-letter:uppercase">
                  {format(new Date(`${date}T00:00:00`), "EEEE d MMMM", { locale: it })}
                </span>
                <form action={restoreTrainingOccurrenceAction}>
                  <input type="hidden" name="ruleId" value={id} />
                  <input type="hidden" name="date" value={date} />
                  <Button type="submit" variant="outline" size="sm">
                    <RotateCcw className="h-3.5 w-3.5" />
                    Ripristina
                  </Button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10 flex flex-col gap-3 rounded-2xl border border-destructive/20 bg-destructive/[0.03] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-foreground">Elimina allenamento</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">Sparisce dal calendario insieme a tutte le sue date.</p>
        </div>
        <form action={deleteTrainingAction}>
          <input type="hidden" name="id" value={training.id} />
          <ConfirmSubmitButton
            confirmMessage={`Eliminare l'allenamento "${training.title}"?`}
            variant="danger"
            size="sm"
          >
            <Trash2 className="h-4 w-4" />
            Elimina
          </ConfirmSubmitButton>
        </form>
      </section>
    </div>
  );
}
