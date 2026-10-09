import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronDown, ChevronRight, ChevronUp, Clock, Globe, Layers, Lock, Trash2, X } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { formatDateLong } from "@/lib/format";
import { Card, CardBody } from "@/components/ui/Card";
import { PageHeader, SectionHeading } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmSubmitButton } from "@/components/forms/ConfirmSubmitButton";
import { BlockContent } from "@/components/schede/BlockContent";
import { cn } from "@/lib/cn";
import { deletePlanAction, removeBlockFromPlanAction, reorderPlanBlockAction } from "../actions";
import { isTrainingPlanAIAvailable } from "@/lib/aiTrainingPlanParser";
import { PlanSplitCheck } from "../PlanSplitCheck";
import { PlanDetailsForm } from "./PlanDetailsForm";
import { todayIso } from "@/lib/today";

export const metadata: Metadata = {
  title: "Scheda allenamento",
};

// La divisione in blocchi con l'IA (con modelli di riserva) può richiedere
// qualche decina di secondi: 60 secondi restano entro il limite di ogni piano Vercel.
export const maxDuration = 60;

export default async function TrainingPlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const repo = await getActiveRepo();
  const plan = await repo.getTrainingPlan(id);
  if (!plan) notFound();

  const [occurrencePlans, trainings] = await Promise.all([
    repo.listTrainingOccurrencePlans(),
    repo.listTrainings({ team: plan.team }),
  ]);
  const planBlocks = plan.blocks;
  const totalMinutes = planBlocks.reduce((sum, b) => sum + b.durationMinutes, 0);

  const trainingTitleById = new Map(trainings.map((t) => [t.id, t.title] as const));
  const todayStr = todayIso();
  const occurrences = occurrencePlans
    .filter((o) => o.planId === plan.id)
    .sort((a, b) => a.occurrenceDate.localeCompare(b.occurrenceDate));

  const iconButton =
    "grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-25";
  // Minuto d'inizio di ogni blocco (somma delle durate precedenti).
  const blockStarts = planBlocks.map((_, i) =>
    planBlocks.slice(0, i).reduce((sum, b) => sum + b.durationMinutes, 0),
  );

  return (
    <div>
      <PageHeader
        back={{ href: "/admin/schede", label: "Schede" }}
        eyebrow="Scheda allenamento"
        title={plan.title}
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <Layers className="h-4 w-4" />
              {planBlocks.length} blocch{planBlocks.length === 1 ? "o" : "i"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              <span className="tabular">{totalMinutes}&apos;</span> totali
            </span>
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
        <section className="min-w-0">
          <SectionHeading title="Blocchi" />
          {planBlocks.length === 0 ? (
            <EmptyState icon={Layers} title="Nessun blocco" description="Questa scheda non ha ancora blocchi." />
          ) : (
            <ol className="space-y-3">
              {planBlocks.map((block, index) => {
                const from = blockStarts[index];
                const to = from + block.durationMinutes;
                return (
                  <li key={block.id} className="flex gap-3 sm:gap-4">
                    <div className="flex flex-col items-center">
                      <span className="tabular grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                        {index + 1}
                      </span>
                      {index < planBlocks.length - 1 && <span className="mt-1.5 w-px flex-1 bg-border-strong" />}
                    </div>
                    <div className="min-w-0 flex-1 rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-display text-base font-bold leading-snug text-foreground">{block.title}</h3>
                          <p className="tabular mt-1 text-xs font-semibold text-muted-foreground">
                            {block.durationMinutes > 0
                              ? `${block.durationMinutes}' · dal minuto ${from} al ${to}`
                              : "Durata non indicata"}
                          </p>
                        </div>
                        <div className="-mr-1.5 -mt-1 flex shrink-0 items-center">
                          <form action={reorderPlanBlockAction}>
                            <input type="hidden" name="planId" value={plan.id} />
                            <input type="hidden" name="blockId" value={block.id} />
                            <input type="hidden" name="direction" value="up" />
                            <button type="submit" disabled={index === 0} aria-label="Sposta su" className={iconButton}>
                              <ChevronUp className="h-4 w-4" />
                            </button>
                          </form>
                          <form action={reorderPlanBlockAction}>
                            <input type="hidden" name="planId" value={plan.id} />
                            <input type="hidden" name="blockId" value={block.id} />
                            <input type="hidden" name="direction" value="down" />
                            <button
                              type="submit"
                              disabled={index === planBlocks.length - 1}
                              aria-label="Sposta giù"
                              className={iconButton}
                            >
                              <ChevronDown className="h-4 w-4" />
                            </button>
                          </form>
                          <form action={removeBlockFromPlanAction}>
                            <input type="hidden" name="planId" value={plan.id} />
                            <input type="hidden" name="blockId" value={block.id} />
                            <button
                              type="submit"
                              aria-label="Rimuovi dalla scheda"
                              className={cn(iconButton, "hover:bg-destructive/8 hover:text-destructive")}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </form>
                        </div>
                      </div>
                      <BlockContent content={block.content} className="mt-3" />
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <aside className="space-y-8">
          <section>
            <SectionHeading title="Programmata per" />
            {occurrences.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border-strong px-4 py-4 text-sm text-muted-foreground">
                Non ancora collegata a nessuna data. Collegala da un allenamento nel calendario.
              </p>
            ) : (
              <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                {occurrences.map((o) => {
                  const isPast = o.occurrenceDate < todayStr;
                  return (
                    <Link
                      key={o.id}
                      href={`/admin/allenamenti/scheda/${o.trainingRuleId}/${o.occurrenceDate}`}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-surface-muted",
                        isPast && "opacity-55",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-foreground">
                          {formatDateLong(o.occurrenceDate)}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {trainingTitleById.get(o.trainingRuleId) ?? "Allenamento"}
                        </span>
                      </span>
                      {o.isPublic ? (
                        <Globe className="h-4 w-4 shrink-0 text-primary" aria-label="Visibile al pubblico" />
                      ) : (
                        <Lock className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="Non pubblica" />
                      )}
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {planBlocks.length > 0 && isTrainingPlanAIAvailable() && (
            <PlanSplitCheck plans={[{ id: plan.id, title: plan.title }]} single />
          )}

          <section>
            <SectionHeading title="Dettagli" />
            <Card>
              <CardBody className="pt-5">
                <PlanDetailsForm plan={plan} />
              </CardBody>
            </Card>
          </section>

          <form action={deletePlanAction}>
            <input type="hidden" name="id" value={plan.id} />
            <ConfirmSubmitButton
              confirmMessage={`Eliminare la scheda "${plan.title}"?`}
              variant="danger-ghost"
              size="sm"
              className="-ml-2"
            >
              <Trash2 className="h-4 w-4" />
              Elimina scheda
            </ConfirmSubmitButton>
          </form>
        </aside>
      </div>
    </div>
  );
}
