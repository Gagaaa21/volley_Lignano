import type { Metadata } from "next";
import Link from "next/link";
import { Clock, ListChecks, Plus, Puzzle } from "lucide-react";
import { getRepo } from "@/lib/db";
import { formatDateLong } from "@/lib/format";
import { Card, CardBody } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";

export const metadata: Metadata = {
  title: "Schede allenamento",
};

export default async function TrainingPlansPage() {
  const repo = await getRepo();
  const [plans, blocks] = await Promise.all([repo.listTrainingPlans(), repo.listTrainingBlocks()]);
  const blockMap = new Map(blocks.map((b) => [b.id, b] as const));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Schede allenamento</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Visibili solo a Developer e Admin. Componi ogni scheda con blocchi riutilizzabili, in
            stile puzzle.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LinkButton href="/admin/schede/blocchi" variant="outline">
            <Puzzle className="h-4 w-4" />
            Libreria blocchi
          </LinkButton>
          <LinkButton href="/admin/schede/nuova">
            <Plus className="h-4 w-4" />
            Nuova scheda
          </LinkButton>
        </div>
      </div>

      {plans.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border-subtle bg-surface px-6 py-12 text-center text-sm text-foreground/50">
          Nessuna scheda ancora. Crea la prima incollando il testo di un allenamento oppure
          componendola da zero con blocchi esistenti.
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {plans.map((plan) => {
            const totalMinutes = plan.blockIds.reduce(
              (sum, id) => sum + (blockMap.get(id)?.durationMinutes ?? 0),
              0,
            );
            return (
              <Link key={plan.id} href={`/admin/schede/${plan.id}`} className="block">
                <Card className="h-full transition-colors hover:border-sea-300 hover:bg-sea-50/40">
                  <CardBody className="pt-5">
                    <h2 className="font-display text-base font-bold text-foreground">{plan.title}</h2>
                    {plan.planDate && (
                      <p className="mt-1 text-sm text-foreground/60">{formatDateLong(plan.planDate)}</p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-medium text-foreground/55">
                      <span className="flex items-center gap-1.5">
                        <Puzzle className="h-3.5 w-3.5" />
                        {plan.blockIds.length} blocch{plan.blockIds.length === 1 ? "o" : "i"}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {totalMinutes}&apos; totali
                      </span>
                    </div>
                    {plan.notes && (
                      <p className="mt-3 flex items-start gap-1.5 text-xs text-foreground/45">
                        <ListChecks className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span className="line-clamp-2">{plan.notes}</span>
                      </p>
                    )}
                  </CardBody>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
