import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, ShieldAlert, ShieldQuestion } from "lucide-react";
import { getRepo } from "@/lib/db";
import { formatDateLong } from "@/lib/format";
import { categoryBadgeClass, categoryLabel } from "@/lib/category";
import { cn } from "@/lib/cn";
import { LinkButton } from "@/components/ui/LinkButton";
import { Card, CardBody } from "@/components/ui/Card";
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

export default async function AthleteAttendancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const repo = await getRepo();
  const [athlete, sessions] = await Promise.all([
    repo.getAthlete(id),
    repo.listAttendanceSessions(),
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

  return (
    <div className="mx-auto max-w-2xl">
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
      <p className="mt-1 text-sm text-muted-foreground">Storico presenze agli allenamenti.</p>

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
        <p className="eyebrow">Storico</p>
        {history.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-border-subtle bg-surface px-6 py-10 text-center text-sm text-muted-foreground">
            Nessuna presenza registrata per questa atleta.
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            {history.map(({ session, status }) => {
              const Icon = STATUS_ICON[status];
              return (
                <Card key={session.id}>
                  <CardBody className="flex items-center justify-between gap-3 pt-5">
                    <div className="min-w-0">
                      <p className="font-medium capitalize text-foreground">
                        {formatDateLong(session.sessionDate)}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {session.title} · {session.location}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                        STATUS_BADGE[status],
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {STATUS_LABEL[status]}
                    </span>
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
