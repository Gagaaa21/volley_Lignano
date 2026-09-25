import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addDays, format } from "date-fns";
import { it } from "date-fns/locale";
import { ArrowLeft, CalendarDays, CalendarRange, ChevronRight, Globe, Puzzle } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { expandTrainings, occurrenceKey } from "@/lib/calendar";
import { LinkButton } from "@/components/ui/LinkButton";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { TrainingForm } from "../TrainingForm";

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
  const rangeStart = training.repeat === "once" ? new Date(`${training.startDate}T00:00:00`) : today;
  const rangeEnd = training.repeat === "once" ? rangeStart : addDays(today, 90);
  const allOccurrences = expandTrainings([training], rangeStart, rangeEnd);
  const occurrences = allOccurrences.slice(0, MAX_OCCURRENCES_PREVIEW);
  const remainingCount = allOccurrences.length - occurrences.length;

  const occurrencePlanByKey = new Map(
    occurrencePlans
      .filter((o) => o.trainingRuleId === id)
      .map((o) => [occurrenceKey(o.trainingRuleId, o.occurrenceDate), o] as const),
  );
  const planById = new Map(allPlans.map((p) => [p.id, p] as const));

  return (
    <div className="mx-auto max-w-xl">
      <LinkButton href="/admin/allenamenti/elenco" variant="ghost" size="sm" className="mb-4 -ml-3.5">
        <ArrowLeft className="h-4 w-4" />
        Torna all&apos;elenco
      </LinkButton>

      <h1 className="font-display text-2xl font-bold text-foreground">Modifica allenamento</h1>
      <p className="mt-1 text-sm text-foreground/60">{training.title}</p>

      <Card className="mt-6">
        <CardHeader>
          <h2 className="font-display text-base font-semibold text-foreground">Dettagli</h2>
        </CardHeader>
        <CardBody>
          <TrainingForm training={training} allowTournament={training.team === "minivolley"} />
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-display text-base font-semibold text-foreground">
                <CalendarDays className="h-4 w-4 text-sea-700" />
                {training.repeat === "once" ? "Scheda" : "Prossime date"}
              </h2>
              <p className="mt-1 text-sm text-foreground/60">
                {training.repeat === "once"
                  ? "Collega una scheda a questo allenamento. Puoi scegliere se renderla visibile alle atlete nei dettagli dell'evento nel calendario pubblico."
                  : "Vale solo per la data scelta, non per l'intera serie ricorrente. Puoi scegliere se renderla visibile alle atlete nei dettagli di quell'evento nel calendario pubblico."}
              </p>
            </div>
            {training.repeat !== "once" && (
              <LinkButton href="/admin/allenamenti" variant="ghost" size="sm" className="shrink-0">
                <CalendarRange className="h-3.5 w-3.5" />
                Calendario completo
              </LinkButton>
            )}
          </div>
        </CardHeader>
        <CardBody className="space-y-1.5">
          {occurrences.length === 0 ? (
            <p className="text-sm text-foreground/50">Nessuna data programmata nei prossimi 90 giorni.</p>
          ) : (
            occurrences.map((occ) => {
              const occurrencePlan = occurrencePlanByKey.get(occurrenceKey(id, occ.date));
              const currentPlan = occurrencePlan ? planById.get(occurrencePlan.planId) : null;

              return (
                <Link
                  key={occ.date}
                  href={`/admin/allenamenti/scheda/${id}/${occ.date}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface-muted/50 px-4 py-3 transition-colors hover:border-primary/25 hover:bg-primary/5"
                >
                  <span className="min-w-[8rem] shrink-0 text-sm font-semibold capitalize text-foreground">
                    {format(new Date(`${occ.date}T00:00:00`), "EEE d MMM", { locale: it })}
                  </span>
                  <span
                    className={cn(
                      "flex min-w-0 flex-1 items-center justify-end gap-1.5 truncate text-sm font-medium",
                      currentPlan ? "text-primary" : "text-foreground/40",
                    )}
                  >
                    {currentPlan && <Puzzle className="h-3.5 w-3.5 shrink-0" />}
                    <span className="truncate">{currentPlan ? currentPlan.title : "Nessuna scheda"}</span>
                    {currentPlan && occurrencePlan?.isPublic && (
                      <Globe className="h-3.5 w-3.5 shrink-0 text-sea-700" aria-label="Visibile al pubblico" />
                    )}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-foreground/30" />
                </Link>
              );
            })
          )}
          {remainingCount > 0 && (
            <Link
              href="/admin/allenamenti"
              className="flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium text-primary hover:underline"
            >
              +{remainingCount} altre date nei prossimi 90 giorni · vedi calendario completo
            </Link>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
