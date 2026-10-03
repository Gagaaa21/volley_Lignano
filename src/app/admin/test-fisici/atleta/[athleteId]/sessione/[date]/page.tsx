import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getActiveRepo } from "@/lib/db";
import { requireStaff } from "@/lib/auth/guard";
import { formatDateShort } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { buildTestSessionValues, isBodyMeasureField, isSquatJumpField } from "@/lib/physicalTestFields";
import { AthleteAvatar } from "../../../../AthleteAvatar";
import { TestBatchForm } from "../../../../nuovo/[athleteId]/TestBatchForm";

export const metadata: Metadata = {
  title: "Modifica sessione di test",
};

/** Modifica di una sessione già registrata: tutte le righe dell'atleta in
 * quella data, con lo stesso modulo dell'inserimento già compilato. */
export default async function EditTestSessionPage({
  params,
}: {
  params: Promise<{ athleteId: string; date: string }>;
}) {
  await requireStaff();
  const { athleteId, date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const repo = await getActiveRepo();
  const athlete = await repo.getAthlete(athleteId);
  if (!athlete) notFound();

  const tests = (await repo.listPhysicalTests({ team: athlete.team })).filter((t) => t.athleteId === athleteId);
  const session = buildTestSessionValues(tests, date);
  if (!session) notFound();

  // Come nell'inserimento: suggerimenti solo per le righe libere.
  const testNameSuggestions = [
    ...new Set(tests.map((t) => t.testName).filter((name) => !isSquatJumpField(name) && !isBodyMeasureField(name))),
  ].sort((a, b) => a.localeCompare(b));

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        back={{ href: `/admin/test-fisici/atleta/${athlete.id}`, label: athlete.fullName }}
        eyebrow="Modifica sessione"
        title={
          <span className="flex items-center gap-3">
            <AthleteAvatar fullName={athlete.fullName} />
            <span className="min-w-0">{athlete.fullName}</span>
          </span>
        }
        description={`Sessione del ${formatDateShort(date)}. Svuota un campo per toglierne il dato.`}
      />

      <TestBatchForm
        athleteId={athlete.id}
        testNameSuggestions={testNameSuggestions}
        bodyMeasurePrefill={{}}
        session={session}
      />
    </div>
  );
}
