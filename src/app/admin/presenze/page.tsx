import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { CheckCircle2, Clock, History, MapPin, Users } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { requireStaff, resolveActiveTeam } from "@/lib/auth/guard";
import { expandTrainings, getMonthGridRange } from "@/lib/calendar";
import { formatMonthParam, parseMonthParam } from "@/lib/month";
import { LinkButton } from "@/components/ui/LinkButton";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { MonthCalendarPicker, type DayMarker } from "@/components/presenze/MonthCalendarPicker";
import { SectionTour } from "@/components/tour/SectionTour";
import { SECTION_PRESENZE_STEPS } from "@/components/tour/sectionSteps";
import { isMinivolleyDateRelevant } from "@/lib/minivolleyAttendance";

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
  const session = await requireStaff();
  const team = await resolveActiveTeam(session);

  const repo = await getActiveRepo();
  const [trainings, sessions, athletes] = await Promise.all([
    repo.listTrainings({ team }),
    repo.listAttendanceSessions({ team }),
    repo.listAthletes({ team }),
  ]);

  const { start, end } = getMonthGridRange(monthDate);
  const occurrences = expandTrainings(trainings, start, end).filter((o) => o.kind === "training");

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const recordedKeys = new Set(sessions.map((s) => `${s.trainingRuleId}_${s.sessionDate}`));
  const activeAthleteCount = athletes.filter((a) => a.isActive).length;

  const markersByDate: Record<string, DayMarker[]> = {};
  const occurrencesByDate = new Map<string, typeof occurrences>();

  for (const occ of occurrences) {
    if (!isMinivolleyDateRelevant(team, occ.date, todayStr)) continue;
    const isRegistered = recordedKeys.has(`${occ.ruleId}_${occ.date}`);
    const status: "registered" | "pending" | "upcoming" = isRegistered
      ? "registered"
      : occ.date <= todayStr
        ? "pending"
        : "upcoming";

    const colorClass =
      status === "registered" ? "bg-success" : status === "pending" ? "bg-warning" : "bg-foreground/25";
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
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="border-b border-border px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Giorno selezionato</p>
          <p className="font-display text-base font-bold text-foreground first-letter:uppercase">
            {format(new Date(date), "EEEE d MMMM", { locale: it })}
          </p>
        </div>
        <div className="divide-y divide-border">
          {occs.map((occ) => {
            const isRegistered = recordedKeys.has(`${occ.ruleId}_${occ.date}`);
            const isUpcoming = occ.date > todayStr;
            return (
              <div key={occ.id} className="px-4 py-3.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-foreground">{occ.title}</p>
                  {isRegistered ? (
                    <Badge tone="success">
                      <CheckCircle2 className="h-3 w-3" />
                      Registrato
                    </Badge>
                  ) : isUpcoming ? (
                    <Badge>Programmato</Badge>
                  ) : (
                    <Badge tone="warning">Da registrare</Badge>
                  )}
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    <span className="tabular">
                      {occ.startTime}–{occ.endTime}
                    </span>
                  </span>
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{occ.location}</span>
                  </span>
                </p>
                {isUpcoming ? (
                  <p className="mt-2.5 text-xs text-muted-foreground">
                    Potrai registrare le presenze il giorno dell&apos;allenamento.
                  </p>
                ) : (
                  <LinkButton
                    href={`/admin/presenze/registra/${occ.ruleId}/${occ.date}`}
                    variant={isRegistered ? "outline" : "primary"}
                    size="sm"
                    className="mt-3 w-full"
                  >
                    {isRegistered ? "Modifica registro" : "Registra presenze"}
                  </LinkButton>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const emptyDetail = (
    <div className="rounded-2xl border border-dashed border-border-strong bg-surface/70 px-6 py-10 text-center text-sm text-muted-foreground">
      Nessun allenamento in programma per questo giorno.
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Presenze"
        description="Seleziona un giorno per registrare le presenze o vedere i dettagli."
        help={<SectionTour steps={SECTION_PRESENZE_STEPS} />}
        actions={
          <div className="flex flex-wrap items-center gap-2" data-tour="section-presenze-toolbar">
            <LinkButton href="/admin/presenze/atlete" variant="outline">
              <Users className="h-4 w-4" />
              Atlete
            </LinkButton>
            <LinkButton href="/admin/presenze/storico" variant="outline">
              <History className="h-4 w-4" />
              Storico
            </LinkButton>
          </div>
        }
      />

      {activeAthleteCount === 0 && (
        <div className="mb-6 rounded-2xl border border-dashed border-border-strong bg-surface/70 px-6 py-6 text-center text-sm text-muted-foreground">
          Non hai ancora aggiunto nessuna atleta.{" "}
          <Link href="/admin/presenze/atlete/nuova" className="font-semibold text-primary hover:underline">
            Aggiungi la prima atleta
          </Link>{" "}
          per iniziare a registrare le presenze.
        </div>
      )}

      <div data-tour="section-presenze-calendar">
        <MonthCalendarPicker
          monthDate={monthDate}
          basePath="/admin/presenze"
          markersByDate={markersByDate}
          detailsByDate={detailsByDate}
          emptyDetail={emptyDetail}
          initialSelectedDate={monthParam === formatMonthParam(new Date()) ? todayStr : `${monthParam}-01`}
          legend={[
            { colorClass: "bg-success", label: "Registrato" },
            { colorClass: "bg-warning", label: "Da registrare" },
            { colorClass: "bg-foreground/25", label: "Programmato" },
          ]}
        />
      </div>
    </div>
  );
}
