import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { formatDateLong } from "@/lib/format";
import { LinkButton } from "@/components/ui/LinkButton";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
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
      <LinkButton href="/admin/presenze/storico" variant="ghost" size="sm" className="mb-4 -ml-3.5">
        <ArrowLeft className="h-4 w-4" />
        Torna allo storico
      </LinkButton>

      <h1 className="font-display text-2xl font-bold text-foreground">Registro presenze</h1>
      <p className="mt-1 capitalize text-sm text-muted-foreground">
        {formatDateLong(session.sessionDate)}
      </p>

      <Card className="mt-6">
        <CardHeader>
          <h2 className="font-display text-base font-semibold text-foreground">{session.title}</h2>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {session.location}
          </p>
        </CardHeader>
        <CardBody>
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
    </div>
  );
}
