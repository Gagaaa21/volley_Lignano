import type { Metadata } from "next";
import Link from "next/link";
import { format, subDays } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarCheck, CheckCircle2, Clock, History, MapPin, Users } from "lucide-react";
import { getRepo } from "@/lib/db";
import { expandTrainings } from "@/lib/calendar";
import { Card, CardBody } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = {
  title: "Presenze",
};

const WINDOW_DAYS_BACK = 21;

export default async function AttendanceHubPage() {
  const repo = await getRepo();
  const [trainings, sessions, athletes] = await Promise.all([
    repo.listTrainings(),
    repo.listAttendanceSessions(),
    repo.listAthletes(),
  ]);

  const today = new Date();
  const windowStart = subDays(today, WINDOW_DAYS_BACK);
  const occurrences = expandTrainings(trainings, windowStart, today).sort((a, b) =>
    b.date === a.date ? 0 : b.date > a.date ? 1 : -1,
  );

  const recordedKeys = new Set(sessions.map((s) => `${s.trainingRuleId}_${s.sessionDate}`));
  const activeAthleteCount = athletes.filter((a) => a.isActive).length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Area riservata</p>
          <h1 className="mt-1.5 font-display text-2xl font-bold text-foreground">Presenze</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Registra le presenze agli allenamenti e consulta lo storico.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LinkButton href="/admin/presenze/atlete" variant="outline">
            <Users className="h-4 w-4" />
            Atlete
          </LinkButton>
          <LinkButton href="/admin/presenze/storico" variant="outline">
            <History className="h-4 w-4" />
            Storico
          </LinkButton>
        </div>
      </div>

      {activeAthleteCount === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-border-subtle bg-surface px-6 py-8 text-center text-sm text-muted-foreground">
          Non hai ancora aggiunto nessuna atleta.{" "}
          <Link href="/admin/presenze/atlete/nuova" className="font-semibold text-primary hover:underline">
            Aggiungi la prima atleta
          </Link>{" "}
          per iniziare a registrare le presenze.
        </div>
      )}

      <div className="mt-6">
        <p className="eyebrow">
          <CalendarCheck className="h-3 w-3" />
          Allenamenti recenti
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Ultimi {WINDOW_DAYS_BACK} giorni, dal più recente.
        </p>

        {occurrences.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-border-subtle bg-surface px-6 py-10 text-center text-sm text-muted-foreground">
            Nessun allenamento in questo periodo.
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            {occurrences.map((occ) => {
              if (occ.kind !== "training") return null;
              const isRecorded = recordedKeys.has(`${occ.ruleId}_${occ.date}`);
              return (
                <Card key={occ.id}>
                  <CardBody className="flex flex-wrap items-center justify-between gap-3 pt-5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold capitalize text-foreground">
                          {format(new Date(occ.date), "EEEE d MMMM", { locale: it })}
                        </p>
                        {isRecorded ? (
                          <Badge className="bg-[var(--color-u14-soft)] text-[var(--color-u14-strong)]">
                            <CheckCircle2 className="h-3 w-3" />
                            Registrato
                          </Badge>
                        ) : (
                          <Badge className="bg-[var(--color-training-soft)] text-[var(--color-training-strong)]">
                            Da registrare
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {occ.startTime}–{occ.endTime}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" />
                          {occ.location}
                        </span>
                      </p>
                    </div>
                    <LinkButton
                      href={`/admin/presenze/registra/${occ.ruleId}/${occ.date}`}
                      variant={isRecorded ? "outline" : "primary"}
                      size="sm"
                    >
                      {isRecorded ? "Modifica" : "Registra"}
                    </LinkButton>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
