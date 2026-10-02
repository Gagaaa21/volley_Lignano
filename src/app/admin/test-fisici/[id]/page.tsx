import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getActiveRepo } from "@/lib/db";
import { requireStaff } from "@/lib/auth/guard";
import { Card, CardBody } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
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
      <PageHeader
        back={{ href: `/admin/test-fisici/atleta/${test.athleteId}`, label: athlete?.fullName ?? "Atleta" }}
        eyebrow={test.testName}
        title="Modifica test"
        description={athlete?.fullName ?? "Atleta eliminata"}
      />
      <Card>
        <CardBody className="pt-6">
          <PhysicalTestForm athleteId={test.athleteId} testNameSuggestions={testNameSuggestions} test={test} />
        </CardBody>
      </Card>
    </div>
  );
}
