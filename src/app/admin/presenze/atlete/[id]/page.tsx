import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { LinkButton } from "@/components/ui/LinkButton";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { AthleteForm } from "../AthleteForm";

export const metadata: Metadata = {
  title: "Modifica atleta",
};

export default async function EditAthletePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = await getActiveRepo();
  const athlete = await repo.getAthlete(id);
  if (!athlete) notFound();

  return (
    <div className="mx-auto max-w-xl">
      <LinkButton href="/admin/presenze/atlete" variant="ghost" size="sm" className="mb-4 -ml-3.5">
        <ArrowLeft className="h-4 w-4" />
        Torna alle atlete
      </LinkButton>

      <h1 className="font-display text-2xl font-bold text-foreground">Modifica atleta</h1>
      <p className="mt-1 text-sm text-muted-foreground">{athlete.fullName}</p>

      <Card className="mt-6">
        <CardHeader>
          <h2 className="font-display text-base font-semibold text-foreground">Dettagli</h2>
        </CardHeader>
        <CardBody>
          <AthleteForm athlete={athlete} />
        </CardBody>
      </Card>
    </div>
  );
}
