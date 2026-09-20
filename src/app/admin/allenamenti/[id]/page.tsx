import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getRepo } from "@/lib/db";
import { LinkButton } from "@/components/ui/LinkButton";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { TrainingForm } from "../TrainingForm";

export const metadata: Metadata = {
  title: "Modifica allenamento",
};

export default async function EditTrainingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = await getRepo();
  const [training, plans] = await Promise.all([repo.getTraining(id), repo.listTrainingPlans()]);
  if (!training) notFound();

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
          <TrainingForm training={training} plans={plans} />
        </CardBody>
      </Card>
    </div>
  );
}
