import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, MapPin } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { formatDateLong } from "@/lib/format";
import { LinkButton } from "@/components/ui/LinkButton";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { AttendanceForm } from "../../../AttendanceForm";

export const metadata: Metadata = {
  title: "Registra presenze",
};

export default async function RecordAttendancePage({
  params,
}: {
  params: Promise<{ ruleId: string; date: string }>;
}) {
  const { ruleId, date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const repo = await getActiveRepo();
  const [training, existingSession, athletes] = await Promise.all([
    repo.getTraining(ruleId),
    repo.getAttendanceSessionByOccurrence(ruleId, date),
    repo.listAthletes(),
  ]);
  if (!training || training.team !== "u14u15") notFound();

  const activeAthletes = athletes.filter((a) => a.isActive);

  return (
    <div className="mx-auto max-w-2xl">
      <LinkButton href="/admin/presenze" variant="ghost" size="sm" className="mb-4 -ml-3.5">
        <ArrowLeft className="h-4 w-4" />
        Torna alle presenze
      </LinkButton>

      <h1 className="font-display text-2xl font-bold text-foreground">
        {existingSession ? "Modifica presenze" : "Registra presenze"}
      </h1>
      <p className="mt-1 capitalize text-sm text-muted-foreground">{formatDateLong(date)}</p>

      <Card className="mt-6">
        <CardHeader>
          <h2 className="font-display text-base font-semibold text-foreground">
            {training.title}
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {training.startTime}–{training.endTime}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {training.location}
            </span>
          </div>
        </CardHeader>
        <CardBody>
          {activeAthletes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border-subtle px-4 py-8 text-center text-sm text-muted-foreground">
              Nessuna atleta attiva in anagrafica.{" "}
              <LinkButton href="/admin/presenze/atlete/nuova" variant="ghost" size="sm" className="mt-2">
                Aggiungine una
              </LinkButton>
            </div>
          ) : (
            <AttendanceForm
              athletes={activeAthletes}
              initialRecords={existingSession?.records ?? {}}
              sessionId={existingSession?.id}
              trainingRuleId={ruleId}
              sessionDate={date}
              title={training.title}
              location={training.location}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
