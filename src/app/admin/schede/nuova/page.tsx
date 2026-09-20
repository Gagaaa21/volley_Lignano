import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { getRepo } from "@/lib/db";
import { LinkButton } from "@/components/ui/LinkButton";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PlanCreateForm } from "../PlanCreateForm";

export const metadata: Metadata = {
  title: "Nuova scheda",
};

export default async function NewTrainingPlanPage() {
  const repo = await getRepo();
  const blocks = await repo.listTrainingBlocks();

  return (
    <div className="mx-auto max-w-2xl">
      <LinkButton href="/admin/schede" variant="ghost" size="sm" className="mb-4 -ml-3.5">
        <ArrowLeft className="h-4 w-4" />
        Torna alle schede
      </LinkButton>

      <h1 className="font-display text-2xl font-bold text-foreground">Nuova scheda allenamento</h1>
      <p className="mt-1 text-sm text-foreground/60">
        Incolla l&apos;allenamento così come lo scrivi di solito: verrà trasformato in blocchi
        riutilizzabili in stile puzzle.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <h2 className="font-display text-base font-semibold text-foreground">Dettagli</h2>
        </CardHeader>
        <CardBody>
          <PlanCreateForm blocks={blocks} />
        </CardBody>
      </Card>
    </div>
  );
}
