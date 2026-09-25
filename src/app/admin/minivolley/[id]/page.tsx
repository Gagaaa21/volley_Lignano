import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { LinkButton } from "@/components/ui/LinkButton";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { TrainingForm } from "../../allenamenti/TrainingForm";

export const metadata: Metadata = {
  title: "Modifica · Minivolley",
};

export default async function EditMinivolleyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = await getActiveRepo();
  const training = await repo.getTraining(id);
  if (!training || training.team !== "minivolley") notFound();

  return (
    <div className="mx-auto max-w-xl">
      <LinkButton href="/admin/minivolley" variant="ghost" size="sm" className="mb-4 -ml-3.5">
        <ArrowLeft className="h-4 w-4" />
        Torna a Minivolley
      </LinkButton>

      <h1 className="font-display text-2xl font-bold text-foreground">
        {training.isTournament ? "Modifica torneo" : "Modifica allenamento"}
      </h1>
      <p className="mt-1 text-sm text-foreground/60">{training.title}</p>

      <Card className="mt-6">
        <CardHeader>
          <h2 className="font-display text-base font-semibold text-foreground">Dettagli</h2>
        </CardHeader>
        <CardBody>
          <TrainingForm training={training} team="minivolley" allowTournament />
        </CardBody>
      </Card>
    </div>
  );
}
