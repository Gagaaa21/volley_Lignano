import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Clock, MapPin } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { formatDateLong } from "@/lib/format";
import { LinkButton } from "@/components/ui/LinkButton";
import { Card, CardBody } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { AttendanceForm } from "../../../AttendanceForm";
import { MiniAttendanceForm } from "../../../MiniAttendanceForm";

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
  const [training, existingSession] = await Promise.all([
    repo.getTraining(ruleId),
    repo.getAttendanceSessionByOccurrence(ruleId, date),
  ]);
  if (!training) notFound();

  const isMini = training.team === "minivolley";
  const athletes = await repo.listAthletes({ team: training.team });
  const activeAthletes = athletes.filter((a) => a.isActive);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        back={{ href: "/admin/presenze", label: "Presenze" }}
        eyebrow={formatDateLong(date)}
        title={existingSession ? "Modifica presenze" : "Registra presenze"}
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-semibold text-foreground/80">{training.title}</span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              <span className="tabular">
                {training.startTime}–{training.endTime}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              {training.location}
            </span>
          </span>
        }
      />

      <Card>
        <CardBody className="pb-0 pt-5 sm:pb-0 sm:pt-6">
          {activeAthletes.length === 0 ? (
            <div className="mb-5 rounded-xl border border-dashed border-border-strong px-4 py-8 text-center text-sm text-muted-foreground">
              Nessuna atleta attiva in anagrafica.
              <div className="mt-3">
                <LinkButton href="/admin/presenze/atlete/nuova" variant="soft" size="sm">
                  Aggiungine una
                </LinkButton>
              </div>
            </div>
          ) : isMini ? (
            <MiniAttendanceForm
              athletes={activeAthletes}
              initialPresentIds={Object.keys(existingSession?.records ?? {})}
              sessionId={existingSession?.id}
              trainingRuleId={ruleId}
              sessionDate={date}
              title={training.title}
              location={training.location}
            />
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
