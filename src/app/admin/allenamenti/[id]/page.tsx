import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { addDays, format } from "date-fns";
import { it } from "date-fns/locale";
import { ArrowLeft, CalendarDays, Puzzle } from "lucide-react";
import { getRepo } from "@/lib/db";
import { expandTrainings, occurrenceKey } from "@/lib/calendar";
import { LinkButton } from "@/components/ui/LinkButton";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Label, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { TrainingForm } from "../TrainingForm";
import { removeOccurrencePlanAction, setOccurrencePlanAction } from "../actions";

export const metadata: Metadata = {
  title: "Modifica allenamento",
};

const MAX_OCCURRENCES = 12;

export default async function EditTrainingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = await getRepo();
  const [training, blocks, allPlans, occurrencePlans] = await Promise.all([
    repo.getTraining(id),
    repo.listTrainingBlocks(),
    repo.listTrainingPlans(),
    repo.listTrainingOccurrencePlans(),
  ]);
  if (!training) notFound();

  const linkedPlan = training.planId ? await repo.getTrainingPlan(training.planId) : null;
  const selectedBlockIds = linkedPlan?.blockIds ?? [];

  const today = new Date();
  const rangeStart = training.repeat === "once" ? new Date(`${training.startDate}T00:00:00`) : today;
  const rangeEnd =
    training.repeat === "once" ? rangeStart : addDays(today, 90);
  const occurrences = expandTrainings([training], rangeStart, rangeEnd).slice(0, MAX_OCCURRENCES);

  const occurrencePlanByKey = new Map(
    occurrencePlans
      .filter((o) => o.trainingRuleId === id)
      .map((o) => [occurrenceKey(o.trainingRuleId, o.occurrenceDate), o.planId] as const),
  );
  const planById = new Map(allPlans.map((p) => [p.id, p] as const));

  return (
    <div className="mx-auto max-w-xl">
      <LinkButton href="/admin/allenamenti" variant="ghost" size="sm" className="mb-4 -ml-3.5">
        <ArrowLeft className="h-4 w-4" />
        Torna agli allenamenti
      </LinkButton>

      <h1 className="font-display text-2xl font-bold text-foreground">Modifica allenamento</h1>
      <p className="mt-1 text-sm text-foreground/60">{training.title}</p>

      <Card className="mt-6">
        <CardHeader>
          <h2 className="font-display text-base font-semibold text-foreground">Dettagli</h2>
        </CardHeader>
        <CardBody>
          <TrainingForm training={training} blocks={blocks} selectedBlockIds={selectedBlockIds} />
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-foreground">
            <CalendarDays className="h-4 w-4 text-sea-700" />
            Scheda per singola data
          </h2>
          <p className="mt-1 text-sm text-foreground/60">
            {training.repeat === "once"
              ? "Collega una scheda esistente a questo allenamento: le atlete la vedranno nei dettagli dell'evento nel calendario pubblico."
              : "Collega una scheda esistente a una data specifica: vale solo per quel giorno, non per l'intera serie ricorrente. Le atlete la vedranno nei dettagli di quell'evento nel calendario pubblico."}
          </p>
        </CardHeader>
        <CardBody className="space-y-3">
          {occurrences.length === 0 ? (
            <p className="text-sm text-foreground/50">Nessuna data programmata nei prossimi 90 giorni.</p>
          ) : (
            occurrences.map((occ) => {
              const currentPlanId = occurrencePlanByKey.get(occurrenceKey(id, occ.date));
              const currentPlan = currentPlanId ? planById.get(currentPlanId) : null;
              const otherPlans = allPlans.filter((p) => p.id !== currentPlanId);

              return (
                <div
                  key={occ.date}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface-muted/50 px-4 py-3"
                >
                  <p className="min-w-[9rem] shrink-0 text-sm font-semibold capitalize text-foreground">
                    {format(new Date(`${occ.date}T00:00:00`), "EEE d MMM", { locale: it })}
                  </p>

                  {currentPlan ? (
                    <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
                      <LinkButton
                        href={`/admin/schede/${currentPlan.id}`}
                        variant="ghost"
                        size="sm"
                        className="text-primary"
                      >
                        <Puzzle className="h-3.5 w-3.5" />
                        {currentPlan.title}
                      </LinkButton>
                      <form action={removeOccurrencePlanAction}>
                        <input type="hidden" name="ruleId" value={id} />
                        <input type="hidden" name="date" value={occ.date} />
                        <Button type="submit" variant="ghost" size="sm" className="text-red-600 hover:bg-red-50">
                          Rimuovi
                        </Button>
                      </form>
                    </div>
                  ) : allPlans.length === 0 ? (
                    <p className="text-xs text-foreground/45">Nessuna scheda in libreria.</p>
                  ) : (
                    <form action={setOccurrencePlanAction} className="flex flex-1 items-center gap-2">
                      <input type="hidden" name="ruleId" value={id} />
                      <input type="hidden" name="date" value={occ.date} />
                      <Label htmlFor={`planId-${occ.date}`} className="sr-only">
                        Scheda
                      </Label>
                      <Select id={`planId-${occ.date}`} name="planId" defaultValue="" className="flex-1">
                        <option value="" disabled>
                          Scegli una scheda…
                        </option>
                        {otherPlans.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title} · {p.blockIds.length} blocch{p.blockIds.length === 1 ? "o" : "i"}
                          </option>
                        ))}
                      </Select>
                      <Button type="submit" variant="outline" size="sm">
                        Collega
                      </Button>
                    </form>
                  )}
                </div>
              );
            })
          )}
        </CardBody>
      </Card>
    </div>
  );
}
