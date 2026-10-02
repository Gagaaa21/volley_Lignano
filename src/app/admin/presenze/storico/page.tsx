import type { Metadata } from "next";
import { ChevronRight, Download, History } from "lucide-react";
import Link from "next/link";
import { it } from "date-fns/locale";
import { format, parseISO } from "date-fns";
import { getActiveRepo } from "@/lib/db";
import { requireStaff, resolveActiveTeam } from "@/lib/auth/guard";
import { isMinivolleyDateRelevant } from "@/lib/minivolleyAttendance";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = {
  title: "Storico presenze",
};

export default async function AttendanceHistoryPage() {
  const session = await requireStaff();
  const repo = await getActiveRepo();
  const team = await resolveActiveTeam(session);
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const allSessions = await repo.listAttendanceSessions({ team });
  const sessions = allSessions.filter((s) => isMinivolleyDateRelevant(team, s.sessionDate, todayStr));

  return (
    <div>
      <PageHeader
        back={{ href: "/admin/presenze", label: "Presenze" }}
        title="Storico presenze"
        description="Tutti i registri salvati, dal più recente. Apri un registro per modificarlo."
        actions={
          <LinkButton href="/api/presenze/storico/csv" variant="outline">
            <Download className="h-4 w-4" />
            Esporta CSV
          </LinkButton>
        }
      />

      {sessions.length === 0 ? (
        <EmptyState
          icon={History}
          title="Nessun registro ancora"
          description="Registra le presenze di un allenamento dal calendario delle presenze."
        />
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          {sessions.map((s) => {
            const statuses = Object.values(s.records);
            const present = statuses.filter((v) => v === "present").length;
            const excused = statuses.filter((v) => v === "excused").length;
            const unexcused = statuses.filter((v) => v === "unexcused").length;
            const total = statuses.length;
            const isMini = s.team === "minivolley";
            const date = parseISO(s.sessionDate);
            return (
              <Link
                key={s.id}
                href={`/admin/presenze/storico/${s.id}`}
                className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-surface-muted sm:px-5"
              >
                <span className="w-11 shrink-0 text-center">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    {format(date, "EEE", { locale: it })}
                  </span>
                  <span className="display-wide tabular block text-[1.375rem] leading-7 text-foreground">
                    {format(date, "d")}
                  </span>
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    {format(date, "MMM", { locale: it })}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-foreground group-hover:text-primary">{s.title}</span>
                  <span className="block truncate text-[13px] text-muted-foreground">{s.location}</span>
                  {!isMini && total > 0 && (
                    <span className="mt-2 flex h-1.5 max-w-xs overflow-hidden rounded-full bg-muted">
                      <span className="bg-success" style={{ width: `${(present / total) * 100}%` }} />
                      <span className="bg-warning" style={{ width: `${(excused / total) * 100}%` }} />
                      <span className="bg-destructive" style={{ width: `${(unexcused / total) * 100}%` }} />
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-right">
                  <span className="tabular block font-display text-lg font-bold leading-tight text-foreground">
                    {present}
                    {!isMini && <span className="text-sm font-semibold text-muted-foreground">/{total}</span>}
                  </span>
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    presenti
                  </span>
                  {!isMini && (excused > 0 || unexcused > 0) && (
                    <span className="tabular mt-0.5 block text-[11px] font-semibold">
                      {excused > 0 && <span className="text-warning">{excused} giust.</span>}
                      {excused > 0 && unexcused > 0 && <span className="text-muted-foreground"> · </span>}
                      {unexcused > 0 && <span className="text-destructive">{unexcused} non giust.</span>}
                    </span>
                  )}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
