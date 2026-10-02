import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getActiveRepo } from "@/lib/db";
import { requireStaff } from "@/lib/auth/guard";
import { PageHeader } from "@/components/ui/PageHeader";
import { BODY_MEASURE_FIELDS, isBodyMeasureField, isSquatJumpField } from "@/lib/physicalTestFields";
import { AthleteAvatar } from "../../AthleteAvatar";
import { TestBatchForm } from "./TestBatchForm";

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

  const tests = (await repo.listPhysicalTests({ team: athlete.team })).filter((t) => t.athleteId === athleteId);
  // Suggerimenti solo per "Altro": i campi Squat Jump/misure corporee hanno
  // già il loro input dedicato, non serve riproporli come testo libero.
  const testNameSuggestions = [
    ...new Set(
      tests
        .map((t) => t.testName)
        .filter((name) => !isSquatJumpField(name) && !isBodyMeasureField(name)),
    ),
  ].sort((a, b) => a.localeCompare(b));

  // Precompila le misure corporee con l'ultimo valore registrato: cambiano
  // di rado, così lo staff parte dal valore attuale invece di ridigitarlo
  // ogni volta se non è cambiato.
  const bodyMeasurePrefill: Record<string, string> = {};
  for (const field of BODY_MEASURE_FIELDS) {
    const latest = [...tests]
      .filter((t) => t.testName === field.testName)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (latest) bodyMeasurePrefill[field.key] = latest.value;
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        back={{ href: "/admin/test-fisici/nuovo", label: "Cambia atleta" }}
        eyebrow="Nuovo test"
        title={
          <span className="flex items-center gap-3">
            <AthleteAvatar fullName={athlete.fullName} />
            <span className="min-w-0">{athlete.fullName}</span>
          </span>
        }
      />

      <div>
        <TestBatchForm
          athleteId={athlete.id}
          testNameSuggestions={testNameSuggestions}
          bodyMeasurePrefill={bodyMeasurePrefill}
        />
      </div>
    </div>
  );
}
