import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronDown, Clock, Globe, Lock, Puzzle } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { formatDateLong } from "@/lib/format";
import { LinkButton } from "@/components/ui/LinkButton";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Label, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { BlockContent } from "@/components/schede/BlockContent";
import { PlanCreateForm } from "@/app/admin/schede/PlanCreateForm";
import { removeOccurrencePlanAction, setOccurrencePlanAction } from "../../../actions";

export const metadata: Metadata = {
  title: "Scheda dell'allenamento",
};

export default async function OccurrencePlanPage({
  params,
}: {
  params: Promise<{ ruleId: string; date: string }>;
}) {
  const { ruleId, date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const repo = await getActiveRepo();
  const [training, occurrencePlan, allPlans, blocks] = await Promise.all([
    repo.getTraining(ruleId),
    repo.getTrainingOccurrencePlan(ruleId, date),
    repo.listTrainingPlans(),
    repo.listTrainingBlocks(),
  ]);
  if (!training) notFound();

  const currentPlan = occurrencePlan ? await repo.getTrainingPlan(occurrencePlan.planId) : null;
  const blockById = new Map(blocks.map((b) => [b.id, b] as const));
  const currentPlanBlocks = currentPlan
    ? currentPlan.blockIds.map((id) => blockById.get(id)).filter((b): b is NonNullable<typeof b> => Boolean(b))
    : [];
  const otherPlans = allPlans.filter((p) => p.id !== currentPlan?.id);

  return (
    <div className="mx-auto max-w-2xl">
      <LinkButton href={`/admin/allenamenti/${ruleId}`} variant="ghost" size="sm" className="mb-4 -ml-3.5">
        <ArrowLeft className="h-4 w-4" />
        Torna all&apos;allenamento
      </LinkButton>

      <p className="eyebrow">{training.title}</p>
      <h1 className="mt-1.5 font-display text-2xl font-bold capitalize text-foreground">
        {formatDateLong(date)}
      </h1>
      <p className="mt-1 text-sm text-foreground/60">
        {training.repeat === "once"
          ? "Questa scheda vale per questo allenamento."
          : "Questa scheda vale solo per questa data: le altre occorrenze della serie ricorrente non cambiano."}
      </p>

      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-display text-base font-semibold text-foreground">
              <Puzzle className="h-4 w-4 text-sea-700" />
              Scheda di questo allenamento
            </h2>
            {currentPlan && (
              <form action={removeOccurrencePlanAction}>
                <input type="hidden" name="ruleId" value={ruleId} />
                <input type="hidden" name="date" value={date} />
                <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:bg-destructive/8">
                  Rimuovi
                </Button>
              </form>
            )}
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          {currentPlan && occurrencePlan ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <LinkButton href={`/admin/schede/${currentPlan.id}`} variant="ghost" size="sm" className="-ml-3.5">
                  {currentPlan.title}
                </LinkButton>
                <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-foreground/50">
                  <Clock className="h-3.5 w-3.5" />
                  {currentPlanBlocks.reduce((sum, b) => sum + b.durationMinutes, 0)}&apos; totali
                </span>
              </div>

              <form
                action={setOccurrencePlanAction}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface-muted/60 px-3.5 py-3"
              >
                <input type="hidden" name="ruleId" value={ruleId} />
                <input type="hidden" name="date" value={date} />
                <input type="hidden" name="planId" value={currentPlan.id} />
                <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-foreground/85">
                  <input
                    type="checkbox"
                    name="isPublic"
                    defaultChecked={occurrencePlan.isPublic}
                    className="h-4 w-4 shrink-0 rounded border-border-subtle accent-sea-700 focus:ring-sea-500"
                  />
                  <span className="flex items-center gap-1.5">
                    {occurrencePlan.isPublic ? (
                      <Globe className="h-3.5 w-3.5 text-sea-700" />
                    ) : (
                      <Lock className="h-3.5 w-3.5 text-foreground/40" />
                    )}
                    Visibile sul calendario pubblico (genitori e atlete)
                  </span>
                </label>
                <Button type="submit" variant="outline" size="sm">
                  Aggiorna
                </Button>
              </form>

              <ol className="space-y-3">
                {currentPlanBlocks.map((block, index) => (
                  <li key={block.id} className="rounded-xl border border-border-subtle bg-surface-muted/60 px-3.5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-foreground">
                        {index + 1}. {block.title}
                      </p>
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--color-training-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-training-strong)]">
                        <Clock className="h-2.5 w-2.5" />
                        {block.durationMinutes}&apos;
                      </span>
                    </div>
                    <BlockContent content={block.content} className="mt-2" />
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="text-sm text-foreground/50">Nessuna scheda collegata a questa data.</p>
          )}

          {otherPlans.length > 0 && (
            <div className={currentPlan ? "space-y-2.5 border-t border-border-subtle pt-4" : "space-y-2.5"}>
              <p className="text-sm font-semibold text-foreground/75">
                {currentPlan ? "Cambia con un'altra scheda" : "Collega una scheda esistente"}
              </p>
              <form action={setOccurrencePlanAction} className="flex flex-col gap-3 sm:flex-row">
                <input type="hidden" name="ruleId" value={ruleId} />
                <input type="hidden" name="date" value={date} />
                <div className="flex-1">
                  <Label htmlFor="planId" className="sr-only">
                    Scheda
                  </Label>
                  <Select id="planId" name="planId" defaultValue="">
                    <option value="" disabled>
                      Scegli una scheda dalla libreria…
                    </option>
                    {otherPlans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} · {p.blockIds.length} blocch{p.blockIds.length === 1 ? "o" : "i"}
                      </option>
                    ))}
                  </Select>
                </div>
                <label className="flex shrink-0 cursor-pointer items-center gap-2 self-center text-sm font-medium text-foreground/85">
                  <input
                    type="checkbox"
                    name="isPublic"
                    className="h-4 w-4 shrink-0 rounded border-border-subtle accent-sea-700 focus:ring-sea-500"
                  />
                  Visibile al pubblico
                </label>
                <Button type="submit" variant="outline">
                  Collega
                </Button>
              </form>
            </div>
          )}
        </CardBody>
      </Card>

      <details className="group mt-6 rounded-2xl border border-border-subtle bg-surface shadow-[0_1px_2px_rgba(9,27,38,0.05),0_10px_24px_-18px_rgba(9,27,38,0.16)] [&::-webkit-details-marker]:hidden marker:content-none">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 sm:px-6 sm:py-5">
          <span>
            <span className="block font-display text-base font-semibold text-foreground">
              {currentPlan ? "Oppure crea una nuova scheda per questa data" : "Oppure crea una nuova scheda"}
            </span>
            <span className="mt-1 block text-sm text-foreground/60">
              Incolla il contenuto dell&apos;allenamento o scegli blocchi già pronti dalla libreria.
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-foreground/40 transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-5 pb-5 sm:px-6 sm:pb-6">
          <PlanCreateForm
            blocks={blocks}
            occurrenceRuleId={ruleId}
            occurrenceDate={date}
            defaultTitle={training.title}
          />
        </div>
      </details>
    </div>
  );
}
