import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { requireStaff } from "@/lib/auth/guard";
import { LinkButton } from "@/components/ui/LinkButton";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PhysicalTestForm } from "../../PhysicalTestForm";

export const metadata: Metadata = {
  title: "Nuovo test fisico",
};

export default async function NewPhysicalTestForAthletePage({
  params,
}: {
  params: Promise<{ athleteId: string }>;
}) {
  await requireStaff();
  const { athleteId } = await params;
  const repo = await getActiveRepo();
  const athlete = await repo.getAthlete(athleteId);
  if (!athlete) notFound();

  const tests = await repo.listPhysicalTests({ team: athlete.team });
  const testNameSuggestions = [...new Set(tests.map((t) => t.testName))].sort((a, b) => a.localeCompare(b));

  return (
    <div className="mx-auto max-w-xl">
      <LinkButton href="/admin/test-fisici/nuovo" variant="ghost" size="sm" className="mb-4 -ml-3.5">
        <ArrowLeft className="h-4 w-4" />
        Cambia atleta
      </LinkButton>

      <h1 className="font-display text-2xl font-bold text-foreground">Nuovo test fisico</h1>
      <p className="mt-1 text-sm text-muted-foreground">{athlete.fullName}</p>

      <Card className="mt-6">
        <CardHeader>
          <h2 className="font-display text-base font-semibold text-foreground">Dettagli</h2>
        </CardHeader>
        <CardBody>
          <PhysicalTestForm athleteId={athlete.id} testNameSuggestions={testNameSuggestions} />
        </CardBody>
      </Card>
    </div>
  );
}
