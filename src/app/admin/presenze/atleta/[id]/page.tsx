import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Check, Clock, MapPin, ShieldAlert, ShieldQuestion, X } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { expandTrainings, getMonthGridRange } from "@/lib/calendar";
import { formatMonthParam, parseMonthParam } from "@/lib/month";
import { categoryBadgeClass, categoryLabel, groupBadgeClass, groupLabel } from "@/lib/category";
import { isMinivolleyDateRelevant } from "@/lib/minivolleyAttendance";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import { Avatar } from "@/components/ui/Avatar";
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
  present: "bg-success-soft text-success",
  excused: "bg-sand-100 text-sand-800",
  unexcused: "bg-destructive/10 text-destructive",
};

const STATUS_ICON: Record<AttendanceStatus, typeof Check> = {
  present: Check,
  excused: ShieldQuestion,
  unexcused: ShieldAlert,
};

const STATUS_DOT: Record<AttendanceStatus, string> = {
  present: "bg-success",
  excused: "bg-warning",
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
      <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-base font-bold text-foreground first-letter:uppercase">
              {format(new Date(occ.date), "EEEE d MMMM", { locale: it })}
            </p>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{occ.title}</p>
          </div>
          {badgeClass && StatusIcon ? (
            <span className={cn("flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", badgeClass)}>
              <StatusIcon className="h-3.5 w-3.5" />
              {label}
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
              {label}
            </span>
          )}
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-muted-foreground">
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
        back={{ href: "/admin/presenze/atlete", label: "Atlete" }}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={athlete.fullName} size="lg" />
            <span className="min-w-0">{athlete.fullName}</span>
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                isMini ? groupBadgeClass(athlete.group) : categoryBadgeClass(athlete.category),
              )}
            >
              {isMini ? groupLabel(athlete.group) : categoryLabel(athlete.category)}
            </span>
            <span>Presenze agli allenamenti, passati e futuri.</span>
          </span>
        }
      />

      <div className={cn("grid grid-cols-2 gap-3 sm:gap-4", !isMini && "lg:grid-cols-4")}>
        <StatTile
          label="Presenza"
          value={presencePct !== null ? `${presencePct}%` : "–"}
          hint={total > 0 ? `su ${total} allenament${total === 1 ? "o" : "i"} registrat${total === 1 ? "o" : "i"}` : undefined}
          tone="primary"
        />
        <StatTile label="Presenze" value={present} tone="success" />
        {!isMini && (
          <>
            <StatTile label="Assenze giustificate" value={excused} tone="warning" />
            <StatTile label="Assenze non giustificate" value={unexcused} />
          </>
        )}
      </div>

      <div className="mt-9">
        <MonthCalendarPicker
          monthDate={monthDate}
          basePath={`/admin/presenze/atleta/${id}`}
          markersByDate={markersByDate}
          detailsByDate={detailsByDate}
          emptyDetail={emptyDetail}
          initialSelectedDate={monthParam === formatMonthParam(new Date()) ? todayStr : `${monthParam}-01`}
          legend={
            isMini
              ? [
                  { colorClass: "bg-success", label: "Presente" },
                  { colorClass: "bg-foreground/25", label: "Assente / programmato" },
                ]
              : [
                  { colorClass: "bg-success", label: "Presente" },
                  { colorClass: "bg-warning", label: "Giustificata" },
                  { colorClass: "bg-destructive", label: "Non giustificata" },
                  { colorClass: "bg-foreground/25", label: "Programmato" },
                ]
          }
        />
      </div>
    </div>
  );
}
