import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarCheck, CheckCircle2, Clock, History, MapPin, Users } from "lucide-react";
import { getRepo } from "@/lib/db";
import { expandTrainings, getMonthGridRange } from "@/lib/calendar";
import { formatMonthParam, parseMonthParam } from "@/lib/month";
import { Card, CardBody } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import { Badge } from "@/components/ui/Badge";
import { MonthCalendarPicker, type DayMarker } from "@/components/presenze/MonthCalendarPicker";

export const metadata: Metadata = {
  title: "Presenze",
};

export default async function AttendanceHubPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const monthDate = parseMonthParam(month);
  const monthParam = formatMonthParam(monthDate);

  const repo = await getRepo();
  const [trainings, sessions, athletes] = await Promise.all([
    repo.listTrainings(),
    repo.listAttendanceSessions(),
    repo.listAthletes(),
  ]);

  const { start, end } = getMonthGridRange(monthDate);
  const occurrences = expandTrainings(trainings, start, end).filter((o) => o.kind === "training");

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const recordedKeys = new Set(sessions.map((s) => `${s.trainingRuleId}_${s.sessionDate}`));
  const activeAthleteCount = athletes.filter((a) => a.isActive).length;

  const markersByDate: Record<string, DayMarker[]> = {};
  const occurrencesByDate = new Map<string, typeof occurrences>();

  for (const occ of occurrences) {
    const isRegistered = recordedKeys.has(`${occ.ruleId}_${occ.date}`);
    const status: "registered" | "pending" | "upcoming" = isRegistered
      ? "registered"
      : occ.date <= todayStr
        ? "pending"
        : "upcoming";

    const colorClass =
      status === "registered"
        ? "bg-[var(--color-u14-strong)]"
        : status === "pending"
          ? "bg-[var(--color-sand-600)]"
          : "bg-foreground/25";
    const label =
      status === "registered" ? "Registrato" : status === "pending" ? "Da registrare" : "Programmato";

    (markersByDate[occ.date] ??= []).push({ colorClass, label });

    const list = occurrencesByDate.get(occ.date);
    if (list) list.push(occ);
    else occurrencesByDate.set(occ.date, [occ]);
  }

  const detailsByDate: Record<string, ReactNode> = {};
  for (const [date, occs] of occurrencesByDate) {
    detailsByDate[date] = (
      <div className="space-y-2.5">
        <p className="capitalize text-sm font-semibold text-foreground">
          {format(new Date(date), "EEEE d MMMM", { locale: it })}
        </p>
        {occs.map((occ) => {
          const isRegistered = recordedKeys.has(`${occ.ruleId}_${occ.date}`);
          const isUpcoming = occ.date > todayStr;
          return (
            <Card key={occ.id}>
              <CardBody className="flex flex-wrap items-center justify-between gap-3 pt-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-foreground">{occ.title}</p>
                    {isRegistered ? (
                      <Badge className="bg-[var(--color-u14-soft)] text-[var(--color-u14-strong)]">
                        <CheckCircle2 className="h-3 w-3" />
                        Registrato
                      </Badge>
                    ) : isUpcoming ? (
                      <Badge className="bg-foreground/8 text-foreground/50">Programmato</Badge>
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
                {isUpcoming ? (
                  <p className="text-xs text-muted-foreground">
                    Potrai registrare le presenze il giorno dell&apos;allenamento.
                  </p>
                ) : (
                  <LinkButton
                    href={`/admin/presenze/registra/${occ.ruleId}/${occ.date}`}
                    variant={isRegistered ? "outline" : "primary"}
                    size="sm"
                  >
                    {isRegistered ? "Modifica" : "Registra"}
                  </LinkButton>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>
    );
  }

  const emptyDetail = (
    <div className="rounded-2xl border border-dashed border-border-subtle bg-surface px-6 py-10 text-center text-sm text-muted-foreground">
      Nessun allenamento in programma per questo giorno.
    </div>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Area riservata</p>
          <h1 className="mt-1.5 font-display text-2xl font-bold text-foreground">Presenze</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Seleziona un giorno per registrare le presenze o vedere i dettagli.
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
          Calendario allenamenti
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Include anche gli allenamenti futuri, non ancora registrabili.
        </p>

        <div className="mt-4">
          <MonthCalendarPicker
            monthDate={monthDate}
            basePath="/admin/presenze"
            markersByDate={markersByDate}
            detailsByDate={detailsByDate}
            emptyDetail={emptyDetail}
            initialSelectedDate={
              monthParam === formatMonthParam(new Date()) ? todayStr : `${monthParam}-01`
            }
          />
        </div>
      </div>
    </div>
  );
}
