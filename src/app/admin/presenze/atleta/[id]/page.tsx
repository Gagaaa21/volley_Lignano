import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { ArrowLeft, Check, Clock, MapPin, ShieldAlert, ShieldQuestion, X } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { expandTrainings, getMonthGridRange } from "@/lib/calendar";
import { formatMonthParam, parseMonthParam } from "@/lib/month";
import { categoryBadgeClass, categoryLabel, groupBadgeClass, groupLabel } from "@/lib/category";
import { isMinivolleyDateRelevant } from "@/lib/minivolleyAttendance";
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

/** Il Minivolley non ha un concetto di assenza giustificata/non
 * giustificata (vedi MiniAttendanceForm): solo presente/assente, dedotto
 * da "il registro di quel giorno esiste e la contiene" — non dal solo
 * valore del record, che per un'assenza non ha proprio una voce. */
type MiniStatus = "present" | "absent";

const MINI_STATUS_LABEL: Record<MiniStatus, string> = {
  present: "Presente",
  absent: "Assente",
};

const MINI_STATUS_BADGE: Record<MiniStatus, string> = {
  present: STATUS_BADGE.present,
  absent: "bg-foreground/8 text-foreground/50",
};

const MINI_STATUS_ICON: Record<MiniStatus, typeof Check> = {
  present: Check,
  absent: X,
};

const MINI_STATUS_DOT: Record<MiniStatus, string> = {
  present: STATUS_DOT.present,
  absent: "bg-foreground/25",
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

  const repo = await getActiveRepo();
  const athlete = await repo.getAthlete(id);
  if (!athlete) notFound();
  const isMini = athlete.team === "minivolley";

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [allSessions, trainings] = await Promise.all([
    repo.listAttendanceSessions({ team: athlete.team }),
    repo.listTrainings({ team: athlete.team }),
  ]);
  const sessions = allSessions.filter((s) => isMinivolleyDateRelevant(athlete.team, s.sessionDate, todayStr));

  // Per il Minivolley un'assenza non ha mai una voce nel record (vedi
  // saveMiniAttendanceAction): "presente" non si può dedurre da
  // s.records[id] da solo, serve sapere quanti allenamenti sono stati
  // registrati in totale per questa squadra.
  let total: number;
  let present: number;
  let excused: number;
  let unexcused: number;
  if (isMini) {
    total = sessions.length;
    present = sessions.filter((s) => id in s.records).length;
    excused = 0;
    unexcused = 0;
  } else {
    const statuses = sessions.filter((s) => id in s.records).map((s) => s.records[id]);
    total = statuses.length;
    present = statuses.filter((s) => s === "present").length;
    excused = statuses.filter((s) => s === "excused").length;
    unexcused = statuses.filter((s) => s === "unexcused").length;
  }
  const presencePct = total > 0 ? Math.round((present / total) * 100) : null;

  const sessionByOccurrence = new Map(sessions.map((s) => [`${s.trainingRuleId}_${s.sessionDate}`, s]));
  const { start, end } = getMonthGridRange(monthDate);
  const occurrences = expandTrainings(trainings, start, end).filter((o) => o.kind === "training");

  const markersByDate: Record<string, DayMarker[]> = {};
  const detailsByDate: Record<string, ReactNode> = {};

  for (const occ of occurrences) {
    const session = sessionByOccurrence.get(`${occ.ruleId}_${occ.date}`);
    const isUpcoming = occ.date > todayStr;

    let label: string;
    let colorClass: string;
    let badgeClass: string | null = null;
    let StatusIcon: typeof Check | null = null;

    if (isMini) {
      const miniStatus: MiniStatus | null = session ? (id in session.records ? "present" : "absent") : null;
      if (miniStatus) {
        label = MINI_STATUS_LABEL[miniStatus];
        colorClass = MINI_STATUS_DOT[miniStatus];
        badgeClass = MINI_STATUS_BADGE[miniStatus];
        StatusIcon = MINI_STATUS_ICON[miniStatus];
      } else {
        label = isUpcoming ? "Programmato" : "Non registrata";
        colorClass = isUpcoming ? "bg-foreground/25" : "bg-foreground/15";
      }
    } else {
      const status = session ? session.records[id] : undefined;
      if (status) {
        label = STATUS_LABEL[status];
        colorClass = STATUS_DOT[status];
        badgeClass = STATUS_BADGE[status];
        StatusIcon = STATUS_ICON[status];
      } else {
        label = isUpcoming ? "Programmato" : "Non registrata";
        colorClass = isUpcoming ? "bg-foreground/25" : "bg-foreground/15";
      }
    }

    (markersByDate[occ.date] ??= []).push({ colorClass, label });

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
          {badgeClass && StatusIcon ? (
            <span
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                badgeClass,
              )}
            >
              <StatusIcon className="h-3.5 w-3.5" />
              {label}
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-foreground/8 px-2.5 py-1 text-xs font-semibold text-foreground/50">
              {label}
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
            isMini ? groupBadgeClass(athlete.group) : categoryBadgeClass(athlete.category),
          )}
        >
          {isMini ? groupLabel(athlete.group) : categoryLabel(athlete.category)}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Tutti gli impegni dell&apos;atleta, passati e futuri: seleziona un giorno per i dettagli.
      </p>

      <div className={cn("mt-6 grid grid-cols-2 gap-3", !isMini && "sm:grid-cols-4")}>
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
        {!isMini && (
          <>
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
          </>
        )}
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
