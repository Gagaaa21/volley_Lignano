import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Globe,
  Lock,
  Plus,
  Puzzle,
  X,
} from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { formatDateLong } from "@/lib/format";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import { Label, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { ConfirmSubmitButton } from "@/components/forms/ConfirmSubmitButton";
import { BlockContent } from "@/components/schede/BlockContent";
import { cn } from "@/lib/cn";
import {
  addBlockToPlanAction,
  deletePlanAction,
  removeBlockFromPlanAction,
  reorderPlanBlockAction,
} from "../actions";
import { PlanDetailsForm } from "./PlanDetailsForm";

export const metadata: Metadata = {
  title: "Scheda allenamento",
};

const ACCENTS = [
  "bg-[var(--color-u14-soft)] text-[var(--color-u14-strong)]",
  "bg-[var(--color-u15-soft)] text-[var(--color-u15-strong)]",
  "bg-[var(--color-training-soft)] text-[var(--color-training-strong)]",
  "bg-sea-100 text-sea-700",
  "bg-sand-200 text-sand-800",
];

export default async function TrainingPlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const repo = await getActiveRepo();
  const plan = await repo.getTrainingPlan(id);
  if (!plan) notFound();

  const [allBlocks, occurrencePlans, trainings] = await Promise.all([
    repo.listTrainingBlocks(),
    repo.listTrainingOccurrencePlans(),
    repo.listTrainings({ team: plan.team }),
  ]);
  const blockMap = new Map(allBlocks.map((b) => [b.id, b] as const));
  const planBlocks = plan.blockIds.map((blockId) => blockMap.get(blockId)).filter(Boolean) as NonNullable<
    ReturnType<typeof blockMap.get>
  >[];
  const availableBlocks = allBlocks.filter((b) => !plan.blockIds.includes(b.id));
  const totalMinutes = planBlocks.reduce((sum, b) => sum + b.durationMinutes, 0);

  const trainingTitleById = new Map(trainings.map((t) => [t.id, t.title] as const));
  const todayStr = new Date().toISOString().slice(0, 10);
  const occurrences = occurrencePlans
    .filter((o) => o.planId === plan.id)
    .sort((a, b) => a.occurrenceDate.localeCompare(b.occurrenceDate));

  return (
    <div className="mx-auto max-w-3xl">
      <LinkButton href="/admin/schede" variant="ghost" size="sm" className="mb-4 -ml-3.5">
        <ArrowLeft className="h-4 w-4" />
        Torna alle schede
      </LinkButton>

      <Card>
        <CardHeader>
          <h2 className="font-display text-base font-semibold text-foreground">Dettagli scheda</h2>
        </CardHeader>
        <CardBody>
          <PlanDetailsForm plan={plan} />
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-foreground">
            <CalendarDays className="h-4 w-4 text-sea-700" />
            Programmata per
          </h2>
        </CardHeader>
        <CardBody>
          {occurrences.length === 0 ? (
            <p className="text-sm text-foreground/50">
              Non ancora collegata a nessuna data. Collegala da un allenamento nel calendario.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {occurrences.map((o) => {
                const isPast = o.occurrenceDate < todayStr;
                return (
                  <li key={o.id}>
                    <Link
                      href={`/admin/allenamenti/scheda/${o.trainingRuleId}/${o.occurrenceDate}`}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-xl border border-border-subtle px-3.5 py-2.5 text-sm transition-colors hover:border-primary/25 hover:bg-primary/5",
                        isPast && "opacity-55",
                      )}
                    >
                      <span className="min-w-0 truncate font-medium text-foreground">
                        {trainingTitleById.get(o.trainingRuleId) ?? "Allenamento"} ·{" "}
                        {formatDateLong(o.occurrenceDate)}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5 text-foreground/45">
                        {o.isPublic ? (
                          <Globe className="h-3.5 w-3.5 text-sea-700" aria-label="Visibile al pubblico" />
                        ) : (
                          <Lock className="h-3.5 w-3.5" aria-label="Non pubblica" />
                        )}
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-sm font-medium text-foreground/60">
          <span className="flex items-center gap-1.5">
            <Puzzle className="h-4 w-4 text-sea-700" />
            {planBlocks.length} blocch{planBlocks.length === 1 ? "o" : "i"}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-sea-700" />
            {totalMinutes}&apos; totali
          </span>
        </div>
        <form action={deletePlanAction}>
          <input type="hidden" name="id" value={plan.id} />
          <ConfirmSubmitButton
            confirmMessage={`Eliminare la scheda "${plan.title}"? I blocchi restano nella libreria.`}
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/8"
          >
            Elimina scheda
          </ConfirmSubmitButton>
        </form>
      </div>

      <ol className="relative mt-6 space-y-4 border-l-2 border-dashed border-border-subtle pl-6">
        {planBlocks.map((block, index) => (
          <li key={block.id} className="relative">
            <span
              className={`absolute -left-[calc(1.5rem+11px)] top-5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${ACCENTS[index % ACCENTS.length]}`}
            >
              {index + 1}
            </span>
            <Card>
              <CardBody className="pt-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-base font-bold text-foreground">{block.title}</h3>
                    <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-foreground/50">
                      <Clock className="h-3 w-3" />
                      {block.durationMinutes}&apos;
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <form action={reorderPlanBlockAction}>
                      <input type="hidden" name="planId" value={plan.id} />
                      <input type="hidden" name="blockId" value={block.id} />
                      <input type="hidden" name="direction" value="up" />
                      <button
                        type="submit"
                        disabled={index === 0}
                        aria-label="Sposta su"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/50 transition-colors hover:bg-surface-muted disabled:opacity-25"
                      >
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
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/50 transition-colors hover:bg-surface-muted disabled:opacity-25"
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
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/50 transition-colors hover:bg-destructive/8 hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                </div>
                <BlockContent content={block.content} className="mt-3" />
              </CardBody>
            </Card>
          </li>
        ))}
      </ol>

      <Card className="mt-6">
        <CardHeader>
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-foreground">
            <Plus className="h-4 w-4 text-sea-700" />
            Aggiungi un blocco
          </h2>
        </CardHeader>
        <CardBody className="space-y-4">
          {availableBlocks.length > 0 ? (
            <form action={addBlockToPlanAction} className="flex flex-col gap-3 sm:flex-row">
              <input type="hidden" name="planId" value={plan.id} />
              <div className="flex-1">
                <Label htmlFor="blockId" className="sr-only">
                  Blocco esistente
                </Label>
                <Select id="blockId" name="blockId" defaultValue="">
                  <option value="" disabled>
                    Scegli un blocco dalla libreria…
                  </option>
                  {availableBlocks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title} · {b.durationMinutes}&apos;
                    </option>
                  ))}
                </Select>
              </div>
              <Button type="submit" variant="outline">
                Aggiungi alla scheda
              </Button>
            </form>
          ) : (
            <p className="text-sm text-foreground/50">
              Tutti i blocchi della libreria sono già in questa scheda.
            </p>
          )}
          <LinkButton href={`/admin/schede/blocchi/nuovo?planId=${plan.id}`} variant="ghost" size="sm">
            <Plus className="h-4 w-4" />
            Crea un nuovo blocco per questa scheda
          </LinkButton>
        </CardBody>
      </Card>
    </div>
  );
}
