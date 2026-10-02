import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapPin, Trash2 } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { formatDateLong } from "@/lib/format";
import { Card, CardBody } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConfirmSubmitButton } from "@/components/forms/ConfirmSubmitButton";
import { deleteAttendanceSessionAction } from "../../actions";
import { AttendanceForm } from "../../AttendanceForm";
import { MiniAttendanceForm } from "../../MiniAttendanceForm";
import type { Athlete } from "@/lib/types";

export const metadata: Metadata = {
  title: "Registro presenze",
};

export default async function AttendanceSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const repo = await getActiveRepo();
  const session = await repo.getAttendanceSession(id);
  if (!session) notFound();
  const isMini = session.team === "minivolley";
  const athletes = await repo.listAthletes({ team: session.team });
  const athleteMap = new Map(athletes.map((a) => [a.id, a]));
  const recordedIds = Object.keys(session.records);

  const missingRecorded = (missingIds: string[]): Athlete[] =>
    missingIds
      .filter((athleteId) => !athleteMap.has(athleteId))
      .map((athleteId) => ({
        id: athleteId,
        fullName: "Atleta rimossa",
        team: session.team,
        category: null,
        group: null,
        isActive: false,
        notes: null,
        createdBy: null,
        createdAt: "",
        updatedAt: "",
      }));

  // Per u14u15 ogni atleta ha sempre una voce (presente o assente), quindi
  // le chiavi del record sono già il roster completo di quel giorno. Per il
  // Minivolley invece records contiene solo le presenti: il roster in
  // modifica dev'essere l'anagrafica attiva corrente (così le assenti
  // restano selezionabili), più un segnaposto per ogni atleta registrata
  // ma nel frattempo eliminata (così i dati storici non spariscono al
  // primo re-salvataggio).
  const recordedAthletes: Athlete[] = isMini
    ? [...athletes.filter((a) => a.isActive), ...missingRecorded(recordedIds)].sort((a, b) =>
        a.fullName.localeCompare(b.fullName),
      )
    : [...recordedIds.map((id) => athleteMap.get(id)), ...missingRecorded(recordedIds)]
        .filter((a): a is Athlete => Boolean(a))
        .sort((a, b) => a.fullName.localeCompare(b.fullName));

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        back={{ href: "/admin/presenze/storico", label: "Storico" }}
        eyebrow={formatDateLong(session.sessionDate)}
        title="Registro presenze"
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-semibold text-foreground/80">{session.title}</span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              {session.location}
            </span>
          </span>
        }
      />

      <Card>
        <CardBody className="pb-0 pt-5 sm:pb-0 sm:pt-6">
          {isMini ? (
            <MiniAttendanceForm
              athletes={recordedAthletes}
              initialPresentIds={recordedIds}
              sessionId={session.id}
              trainingRuleId={session.trainingRuleId}
              sessionDate={session.sessionDate}
              title={session.title}
              location={session.location}
            />
          ) : (
            <AttendanceForm
              athletes={recordedAthletes}
              initialRecords={session.records}
              sessionId={session.id}
              trainingRuleId={session.trainingRuleId}
              sessionDate={session.sessionDate}
              title={session.title}
              location={session.location}
            />
          )}
        </CardBody>
      </Card>

      <form action={deleteAttendanceSessionAction} className="mt-6">
        <input type="hidden" name="id" value={session.id} />
        <ConfirmSubmitButton
          confirmMessage={`Eliminare il registro di "${session.title}" del ${formatDateLong(session.sessionDate)}?`}
          variant="danger-ghost"
          size="sm"
          className="-ml-2"
        >
          <Trash2 className="h-4 w-4" />
          Elimina questo registro
        </ConfirmSubmitButton>
      </form>
    </div>
  );
}
