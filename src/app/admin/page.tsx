import type { Metadata } from "next";
import { CalendarClock, CheckCircle2, Swords, Users } from "lucide-react";
import { getRepo } from "@/lib/db";
import { requireStaff } from "@/lib/auth/guard";
import { formatDateShort } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/category";
import { CardBody } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ password_changed?: string }>;
}) {
  const session = await requireStaff();
  const { password_changed } = await searchParams;
  const repo = await getRepo();

  const [trainings, matches, staff] = await Promise.all([
    repo.listTrainings(),
    repo.listMatches(),
    repo.listStaff(),
  ]);

  const activeTrainings = trainings.filter((t) => t.isActive);
  const todayStr = new Date().toISOString().slice(0, 10);
  const nextMatch = matches
    .filter((m) => m.matchDate.slice(0, 10) >= todayStr)
    .sort((a, b) => a.matchDate.localeCompare(b.matchDate))[0];

  return (
    <div>
      {password_changed && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-[var(--color-u14)]/30 bg-[var(--color-u14-soft)] px-4 py-3 text-sm font-medium text-[var(--color-u14-strong)]">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Password aggiornata con successo.
        </div>
      )}

      <p className="eyebrow">Dashboard</p>
      <h1 className="mt-1.5 font-display text-2xl font-bold text-foreground">Ciao, {session.fullName}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Ecco una panoramica del calendario di Volley Lignano.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="stat-card">
          <CardBody className="pt-5">
            <div className="flex items-center gap-3">
              <span className="icon-chip">
                <CalendarClock className="h-5 w-5" />
              </span>
              <div>
                <p className="text-2xl font-bold text-foreground">{activeTrainings.length}</p>
                <p className="text-xs text-muted-foreground">Allenamenti attivi</p>
              </div>
            </div>
          </CardBody>
        </div>
        <div className="stat-card">
          <CardBody className="pt-5">
            <div className="flex items-center gap-3">
              <span className="icon-chip">
                <Swords className="h-5 w-5" />
              </span>
              <div>
                <p className="text-2xl font-bold text-foreground">{matches.length}</p>
                <p className="text-xs text-muted-foreground">Partite in calendario</p>
              </div>
            </div>
          </CardBody>
        </div>
        <div className="stat-card">
          <CardBody className="pt-5">
            <div className="flex items-center gap-3">
              <span className="icon-chip">
                <Users className="h-5 w-5" />
              </span>
              <div>
                <p className="text-2xl font-bold text-foreground">{staff.length}</p>
                <p className="text-xs text-muted-foreground">Membri dello staff</p>
              </div>
            </div>
          </CardBody>
        </div>
      </div>

      {nextMatch && (
        <div className="section-card mt-6">
          <CardBody className="pt-6">
            <p className="eyebrow">Prossima partita</p>
            <p className="mt-2 font-display text-lg font-bold text-foreground">
              {CATEGORY_LABELS[nextMatch.category]} · {nextMatch.isHome ? "vs" : "@"} {nextMatch.opponent}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatDateShort(nextMatch.matchDate.slice(0, 10))} alle {nextMatch.matchDate.slice(11, 16)} ·{" "}
              {nextMatch.location}
            </p>
          </CardBody>
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <LinkButton href="/admin/allenamenti" variant="outline" size="lg" className="justify-start">
          <CalendarClock className="h-4 w-4" />
          Gestisci allenamenti
        </LinkButton>
        <LinkButton href="/admin/partite" variant="outline" size="lg" className="justify-start">
          <Swords className="h-4 w-4" />
          Gestisci partite
        </LinkButton>
        <LinkButton href="/admin/staff" variant="outline" size="lg" className="justify-start">
          <Users className="h-4 w-4" />
          Gestisci staff
        </LinkButton>
      </div>
    </div>
  );
}
