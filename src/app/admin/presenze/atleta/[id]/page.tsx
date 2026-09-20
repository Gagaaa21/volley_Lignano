import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { ArrowLeft, Check, Clock, MapPin, ShieldAlert, ShieldQuestion } from "lucide-react";
import { getRepo } from "@/lib/db";
import { expandTrainings, getMonthGridRange } from "@/lib/calendar";
import { formatMonthParam, parseMonthParam } from "@/lib/month";
import { categoryBadgeClass, categoryLabel } from "@/lib/category";
import { cn } from "@/lib/cn";
import { LinkButton } from "@/components/ui/LinkButton";
import { Card, CardBody } from "@/components/ui/Card";
import { MonthCalendarPicker, type DayMarker } from "@/components/presenze/MonthCalendarPicker";
import type { AttendanceStatus } from "@/lib/types";

export const metadata: Metadata = {
  title: "Presenze atleta",
};

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: "Presente",
  excused: "Assenza giustificata",
  unexcused: "Assenza non giustificata",
};

const STATUS_BADGE: Record<AttendanceStatus, string> = {
  present: "bg-[var(--color-u14-soft)] text-[var(--color-u14-strong)]",
  excused: "bg-sand-100 text-sand-800",
  unexcused: "bg-destructive/10 text-destructive",
};

const STATUS_ICON: Record<AttendanceStatus, typeof Check> = {
  present: Check,
  excused: ShieldQuestion,
  unexcused: ShieldAlert,
};

const STATUS_DOT: Record<AttendanceStatus, string> = {
  present: "bg-[var(--color-u14-strong)]",
  excused: "bg-[var(--color-sand-600)]",
  unexcused: "bg-destructive",
};

export default async function AthleteAttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { id } = await params;
  const { month } = await searchParams;
  const monthDate = parseMonthParam(month);
  const monthParam = formatMonthParam(monthDate);

  const repo = await getRepo();
  const [athlete, sessions, trainings] = await Promise.all([
    repo.getAthlete(id),
    repo.listAttendanceSessions(),
    repo.listTrainings(),
  ]);
  if (!athlete) notFound();

  const history = sessions
    .filter((s) => id in s.records)
    .map((s) => ({ session: s, status: s.records[id] }))
    .sort((a, b) => b.session.sessionDate.localeCompare(a.session.sessionDate));

  const total = history.length;
  const present = history.filter((h) => h.status === "present").length;
  const excused = history.filter((h) => h.status === "excused").length;
  const unexcused = history.filter((h) => h.status === "unexcused").length;
  const presencePct = total > 0 ? Math.round((present / total) * 100) : null;

  const sessionByOccurrence = new Map(sessions.map((s) => [`${s.trainingRuleId}_${s.sessionDate}`, s]));
  const { start, end } = getMonthGridRange(monthDate);
  const occurrences = expandTrainings(trainings, start, end).filter((o) => o.kind === "training");
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const markersByDate: Record<string, DayMarker[]> = {};
  const detailsByDate: Record<string, ReactNode> = {};

  for (const occ of occurrences) {
    const session = sessionByOccurrence.get(`${occ.ruleId}_${occ.date}`);
    const status = session ? session.records[id] : undefined;
    const isUpcoming = occ.date > todayStr;

    const colorClass = status
      ? STATUS_DOT[status]
      : isUpcoming
        ? "bg-foreground/25"
        : "bg-foreground/15";
    const label = status ? STATUS_LABEL[status] : isUpcoming ? "Programmato" : "Non registrata";
    (markersByDate[occ.date] ??= []).push({ colorClass, label });

    const StatusIcon = status ? STATUS_ICON[status] : null;
    detailsByDate[occ.date] = (
      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-3 pt-5">
          <div className="min-w-0">
            <p className="capitalize font-semibold text-foreground">
              {format(new Date(occ.date), "EEEE d MMMM", { locale: it })}
            </p>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{occ.title}</p>
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
          {status && StatusIcon ? (
            <span
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                STATUS_BADGE[status],
              )}
            >
              <StatusIcon className="h-3.5 w-3.5" />
              {STATUS_LABEL[status]}
            </span>
          ) : isUpcoming ? (
            <span className="shrink-0 rounded-full bg-foreground/8 px-2.5 py-1 text-xs font-semibold text-foreground/50">
              Programmato
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-foreground/8 px-2.5 py-1 text-xs font-semibold text-foreground/50">
              Non registrata
            </span>
          )}
        </CardBody>
      </Card>
    );
  }

  const emptyDetail = (
    <div className="rounded-2xl border border-dashed border-border-subtle bg-surface px-6 py-10 text-center text-sm text-muted-foreground">
      Nessun allenamento in programma per questo giorno.
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl">
      <LinkButton href="/admin/presenze/atlete" variant="ghost" size="sm" className="mb-4 -ml-3.5">
        <ArrowLeft className="h-4 w-4" />
        Torna alle atlete
      </LinkButton>

      <div className="flex flex-wrap items-center gap-2.5">
        <h1 className="font-display text-2xl font-bold text-foreground">{athlete.fullName}</h1>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide",
            categoryBadgeClass(athlete.category),
          )}
        >
          {categoryLabel(athlete.category)}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Tutti gli impegni dell&apos;atleta, passati e futuri: seleziona un giorno per i dettagli.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="stat-card">
          <CardBody className="pt-5">
            <p className="text-2xl font-bold text-foreground">{presencePct ?? "–"}{presencePct !== null && "%"}</p>
            <p className="text-xs text-muted-foreground">Presenza</p>
          </CardBody>
        </div>
        <div className="stat-card">
          <CardBody className="pt-5">
            <p className="text-2xl font-bold text-foreground">{present}</p>
            <p className="text-xs text-muted-foreground">Presenze</p>
          </CardBody>
        </div>
        <div className="stat-card">
          <CardBody className="pt-5">
            <p className="text-2xl font-bold text-foreground">{excused}</p>
            <p className="text-xs text-muted-foreground">Giustificate</p>
          </CardBody>
        </div>
        <div className="stat-card">
          <CardBody className="pt-5">
            <p className="text-2xl font-bold text-foreground">{unexcused}</p>
            <p className="text-xs text-muted-foreground">Non giustificate</p>
          </CardBody>
        </div>
      </div>

      <div className="mt-8">
        <p className="eyebrow">Calendario impegni</p>
        <div className="mt-4">
          <MonthCalendarPicker
            monthDate={monthDate}
            basePath={`/admin/presenze/atleta/${id}`}
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
