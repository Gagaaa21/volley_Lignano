import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronDown, ClipboardList, Clock, ExternalLink, Globe, Lock } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { formatDateLong } from "@/lib/format";
import { LinkButton } from "@/components/ui/LinkButton";
import { Card, CardBody } from "@/components/ui/Card";
import { PageHeader, SectionHeading } from "@/components/ui/PageHeader";
import { Label, Select, Toggle } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { BlockContent } from "@/components/schede/BlockContent";
import { PlanCreateForm } from "@/app/admin/schede/PlanCreateForm";
import { expandTrainings, occurrenceSchedule } from "@/lib/calendar";
import { removeOccurrencePlanAction, setOccurrencePlanAction } from "../../../actions";
import { OccurrenceOverrideForm } from "../../../OccurrenceOverrideForm";

export const metadata: Metadata = {
  title: "Allenamento del giorno",
};

// La divisione in blocchi con l'IA (con modelli di riserva) può richiedere
// qualche decina di secondi: 60 secondi restano entro il limite di ogni piano Vercel.
export const maxDuration = 60;

export default async function OccurrencePlanPage({
  params,
}: {
  params: Promise<{ ruleId: string; date: string }>;
}) {
  const { ruleId, date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const repo = await getActiveRepo();
  const [training, occurrencePlan] = await Promise.all([
    repo.getTraining(ruleId),
    repo.getTrainingOccurrencePlan(ruleId, date),
  ]);
  if (!training) notFound();
  // Solo schede della stessa squadra dell'allenamento: mai proporre di
  // collegare una scheda Minivolley a un allenamento U14/U15 o viceversa.
  const [allPlans, teamTrainings] = await Promise.all([
    repo.listTrainingPlans({ team: training.team }),
    repo.listTrainings({ team: training.team }),
  ]);
  // Orario e luogo di questo giorno: quelli di sempre o quelli cambiati solo per oggi.
  const schedule = occurrenceSchedule(training, date);
  const day = new Date(`${date}T00:00:00`);
  const canOverride =
    training.repeat !== "once" && expandTrainings([{ ...training, occurrenceOverrides: [] }], day, day).length > 0;
  const locationSuggestions = [
    ...new Set(
      teamTrainings.flatMap((t) => [t.location, ...(t.occurrenceOverrides ?? []).map((o) => o.location)]),
    ),
  ]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "it"));

  const currentPlan = occurrencePlan ? await repo.getTrainingPlan(occurrencePlan.planId) : null;
  const currentPlanBlocks = currentPlan?.blocks ?? [];
  const otherPlans = allPlans.filter((p) => p.id !== currentPlan?.id);

  const totalMinutes = currentPlanBlocks.reduce((sum, b) => sum + b.durationMinutes, 0);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        back={{ href: "/admin/allenamenti", label: "Calendario" }}
        eyebrow={training.title}
        title={formatDateLong(date)}
        description={
          training.repeat === "once"
            ? `${training.startTime}–${training.endTime} · ${training.location}`
            : `${schedule.startTime}–${schedule.endTime} · ${schedule.location}${
                schedule.usual ? " (cambiato solo per questo giorno)" : ""
              }. Le modifiche qui sotto valgono solo per questa data.`
        }
        actions={
          <LinkButton href={`/admin/allenamenti/${ruleId}`} variant="outline" size="sm">
            Modifica allenamento
          </LinkButton>
        }
      />

      {canOverride && (
        <Card className="mb-9">
          <CardBody className="pt-5 sm:pt-6">
            <OccurrenceOverrideForm
              ruleId={ruleId}
              date={date}
              current={{ startTime: schedule.startTime, endTime: schedule.endTime, location: schedule.location }}
              usual={schedule.usual}
              locationSuggestions={locationSuggestions}
            />
          </CardBody>
        </Card>
      )}

      {canOverride && <SectionHeading title="Scheda" description="La scheda vale solo per questa data." />}
      {currentPlan && occurrencePlan ? (
        <Card>
          <CardBody className="pt-5 sm:pt-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="icon-chip">
                  <ClipboardList className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Scheda collegata</p>
                  <Link
                    href={`/admin/schede/${currentPlan.id}`}
                    className="group inline-flex max-w-full items-center gap-1.5 font-display text-lg font-bold text-foreground hover:text-primary"
                  >
                    <span className="truncate">{currentPlan.title}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-50 group-hover:opacity-100" />
                  </Link>
                </div>
              </div>
              <span className="tabular flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-foreground/70">
                <Clock className="h-3.5 w-3.5" />
                {totalMinutes}&apos;
              </span>
            </div>

            <ol className="mt-5 space-y-2.5">
              {currentPlanBlocks.map((block, index) => (
                <li key={block.id} className="rounded-2xl border border-border bg-surface-muted px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-foreground">
                      <span className="tabular mr-1.5 text-muted-foreground">{index + 1}.</span>
                      {block.title}
                    </p>
                    {block.durationMinutes > 0 && (
                      <span className="tabular shrink-0 rounded-full bg-card px-2 py-0.5 text-[11px] font-bold text-foreground/70 ring-1 ring-border">
                        {block.durationMinutes}&apos;
                      </span>
                    )}
                  </div>
                  <BlockContent content={block.content} className="mt-2" />
                </li>
              ))}
            </ol>

            <form action={setOccurrencePlanAction} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <input type="hidden" name="ruleId" value={ruleId} />
              <input type="hidden" name="date" value={date} />
              <input type="hidden" name="planId" value={currentPlan.id} />
              <Toggle
                name="isPublic"
                defaultChecked={occurrencePlan.isPublic}
                className="flex-1"
                label={
                  <span className="flex items-center gap-1.5">
                    {occurrencePlan.isPublic ? (
                      <Globe className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    Visibile sul calendario pubblico
                  </span>
                }
                description="Genitori e atlete la vedono nei dettagli dell'allenamento."
              />
              <Button type="submit" variant="outline">
                Salva
              </Button>
            </form>

            <form action={removeOccurrencePlanAction} className="mt-4 border-t border-border pt-4">
              <input type="hidden" name="ruleId" value={ruleId} />
              <input type="hidden" name="date" value={date} />
              <Button type="submit" variant="danger-ghost" size="sm" className="-ml-2">
                Scollega la scheda da questa data
              </Button>
            </form>
          </CardBody>
        </Card>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border-strong bg-surface/70 px-5 py-5">
          <span className="icon-chip">
            <ClipboardList className="h-5 w-5" />
          </span>
          <div>
            <p className="font-semibold text-foreground">Nessuna scheda collegata</p>
            <p className="text-sm text-muted-foreground">Scegline una dalla libreria o creane una nuova qui sotto.</p>
          </div>
        </div>
      )}

      {otherPlans.length > 0 && (
        <section className="mt-9">
          <SectionHeading title={currentPlan ? "Cambia scheda" : "Collega una scheda esistente"} />
          <form
            action={setOccurrencePlanAction}
            className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5"
          >
            <input type="hidden" name="ruleId" value={ruleId} />
            <input type="hidden" name="date" value={date} />
            <div>
              <Label htmlFor="planId">Scheda</Label>
              <Select id="planId" name="planId" defaultValue="">
                <option value="" disabled>
                  Scegli una scheda dalla libreria…
                </option>
                {otherPlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} · {p.blocks.length} blocch{p.blocks.length === 1 ? "o" : "i"}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Toggle name="isPublic" label="Visibile al pubblico" className="flex-1" />
              <Button type="submit">Collega</Button>
            </div>
          </form>
        </section>
      )}

      <details className="group mt-9 overflow-hidden rounded-2xl border border-border bg-card shadow-card [&::-webkit-details-marker]:hidden marker:content-none">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-surface-muted sm:px-6">
          <span>
            <span className="block font-display text-base font-bold text-foreground">Crea una nuova scheda per questa data</span>
            <span className="mt-0.5 block text-sm text-muted-foreground">
              Incolla il testo dell&apos;allenamento: viene diviso automaticamente in blocchi.
            </span>
          </span>
          <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-border px-5 pb-5 pt-5 sm:px-6 sm:pb-6">
          <PlanCreateForm occurrenceRuleId={ruleId} occurrenceDate={date} defaultTitle={training.title} />
        </div>
      </details>
    </div>
  );
}
