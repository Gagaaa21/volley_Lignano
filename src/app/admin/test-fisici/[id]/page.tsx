import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { requireStaff } from "@/lib/auth/guard";
import { LinkButton } from "@/components/ui/LinkButton";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PhysicalTestForm } from "../PhysicalTestForm";

export const metadata: Metadata = {
  title: "Modifica test fisico",
};

export default async function EditPhysicalTestPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const repo = await getActiveRepo();
  const test = await repo.getPhysicalTest(id);
  if (!test) notFound();

  const [athlete, tests] = await Promise.all([
    repo.getAthlete(test.athleteId),
    repo.listPhysicalTests({ team: test.team }),
  ]);
  const testNameSuggestions = [...new Set(tests.map((t) => t.testName))].sort((a, b) => a.localeCompare(b));

  return (
    <div className="mx-auto max-w-xl">
      <LinkButton href={`/admin/test-fisici/atleta/${test.athleteId}`} variant="ghost" size="sm" className="mb-4 -ml-3.5">
        <ArrowLeft className="h-4 w-4" />
        Torna ai test di {athlete?.fullName ?? "questa atleta"}
      </LinkButton>

      <h1 className="font-display text-2xl font-bold text-foreground">Modifica test fisico</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {test.testName} · {athlete?.fullName ?? "Atleta eliminata"}
      </p>

      <Card className="mt-6">
        <CardHeader>
          <h2 className="font-display text-base font-semibold text-foreground">Dettagli</h2>
        </CardHeader>
        <CardBody>
          <PhysicalTestForm athleteId={test.athleteId} testNameSuggestions={testNameSuggestions} test={test} />
        </CardBody>
      </Card>
    </div>
  );
}
