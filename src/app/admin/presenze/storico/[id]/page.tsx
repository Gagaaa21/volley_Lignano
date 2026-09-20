import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import { getRepo } from "@/lib/db";
import { formatDateLong } from "@/lib/format";
import { LinkButton } from "@/components/ui/LinkButton";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { AttendanceForm } from "../../AttendanceForm";
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
  const repo = await getRepo();
  const [session, athletes] = await Promise.all([
    repo.getAttendanceSession(id),
    repo.listAthletes(),
  ]);
  if (!session) notFound();

  const athleteMap = new Map(athletes.map((a) => [a.id, a]));
  const recordedAthletes: Athlete[] = Object.keys(session.records)
    .map(
      (athleteId) =>
        athleteMap.get(athleteId) ?? {
          id: athleteId,
          fullName: "Atleta rimossa",
          category: null,
          isActive: false,
          notes: null,
          createdBy: null,
          createdAt: "",
          updatedAt: "",
        },
    )
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
          <AttendanceForm
            athletes={recordedAthletes}
            initialRecords={session.records}
            sessionId={session.id}
            trainingRuleId={session.trainingRuleId}
            sessionDate={session.sessionDate}
            title={session.title}
            location={session.location}
          />
        </CardBody>
      </Card>
    </div>
  );
}
