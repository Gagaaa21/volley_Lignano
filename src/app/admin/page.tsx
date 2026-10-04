import type { Metadata } from "next";
import Link from "next/link";
import { addDays, format, parseISO, subDays } from "date-fns";
import { it } from "date-fns/locale";
import {
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  MapPin,
  Plus,
  Swords,
  Users,
} from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { requireStaff, resolveActiveTeam, getOwnStaff } from "@/lib/auth/guard";
import { expandTrainings, matchTitle, matchesToEvents, sortEvents } from "@/lib/calendar";
import { categoryDotClass, CATEGORY_LABELS, MATCH_NO_CATEGORY_LABEL, trainingDotClass } from "@/lib/category";
import { cn } from "@/lib/cn";
import { StatTile } from "@/components/ui/StatTile";
import { SectionHeading } from "@/components/ui/PageHeader";
import { LinkButton } from "@/components/ui/LinkButton";
import { ADMIN_PAGES, isPageAvailableForTeam, type AdminPage, type CalendarEvent } from "@/lib/types";
import { isMinivolleyDateRelevant } from "@/lib/minivolleyAttendance";
import { scheduleFederationRefresh } from "@/lib/federation/auto";
import { actionableProposals, loadOfficialResults } from "@/lib/federation/load";

export const metadata: Metadata = {
  title: "Dashboard",
};

const QUICK_ACTIONS: { href: string; label: string; icon: typeof Plus; page: AdminPage }[] = [
  { href: "/admin/allenamenti/nuovo", label: "Nuovo allenamento", icon: CalendarPlus, page: "allenamenti" },
  { href: "/admin/partite/nuovo", label: "Nuova partita", icon: Swords, page: "partite" },
  { href: "/admin/schede/nuova", label: "Nuova scheda", icon: ClipboardList, page: "schede" },
];

function eventHref(event: CalendarEvent) {
  return event.kind === "training" ? `/admin/allenamenti/${event.ruleId}` : `/admin/partite/${event.id}`;
}

// La lettura dei gironi dal portale (qualche tentativo ciascuno) può superare
// il tempo massimo di default delle funzioni, soprattutto sul piano gratuito di
// Vercel: 60 secondi bastano e restano entro il limite anche di quel piano.
export const maxDuration = 60;

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ password_changed?: string }>;
}) {
  const session = await requireStaff();
  const { password_changed } = await searchParams;
  const repo = await getActiveRepo();

  // La dashboard riflette la squadra attiva nello switcher, come le sezioni
  // Allenamenti/Partite/Schede/Presenze.
  const team = await resolveActiveTeam(session);
  // Non permessi account: "Partite" e "Presenze" non esistono per la
  // squadra Minivolley (vedi isPageAvailableForTeam), quindi vale anche per
  // un Developer.
  const showMatches = isPageAvailableForTeam("partite", team);
  const showPresenze = isPageAvailableForTeam("presenze", team);

  let allowedPages: readonly AdminPage[] = ADMIN_PAGES;
  if (session.role !== "dev") {
    const staff = await getOwnStaff(session.sub);
    allowedPages = staff?.allowedPages ?? [];
  }
  const quickActions = QUICK_ACTIONS.filter(
    (action) => isPageAvailableForTeam(action.page, team) && allowedPages.includes(action.page),
  );

  const [trainings, matches, athletes, attendanceSessions] = await Promise.all([
    repo.listTrainings({ team }),
    showMatches ? repo.listMatches({ team }) : Promise.resolve([]),
    repo.listAthletes({ team }),
    showPresenze ? repo.listAttendanceSessions({ team }) : Promise.resolve([]),
  ]);

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  // Risultati ufficiali della federazione ancora da confermare (solo U14/U15
  // e solo per chi ha accesso a Partite).
  const showOfficial = team === "u14u15" && showMatches && allowedPages.includes("partite");
  if (showOfficial) scheduleFederationRefresh();
  const officialToConfirm = showOfficial ? actionableProposals(await loadOfficialResults(repo)).length : 0;

  const activeTrainings = trainings.filter((t) => t.isActive);
  const activeAthletes = athletes.filter((a) => a.isActive);

  const recordedKeys = new Set(attendanceSessions.map((s) => `${s.trainingRuleId}_${s.sessionDate}`));
  const pendingOccurrences = showPresenze
    ? expandTrainings(trainings, subDays(today, 21), today)
        .filter(
          (o) =>
            o.kind === "training" &&
            !recordedKeys.has(`${o.ruleId}_${o.date}`) &&
            isMinivolleyDateRelevant(team, o.date, todayStr),
        )
        .reverse()
    : [];

  const upcomingTrainingEvents = expandTrainings(trainings, today, addDays(today, 60));
  const upcomingMatchEvents = matchesToEvents(matches).filter((e) => e.date >= todayStr);
  const upcomingEvents = sortEvents([...upcomingTrainingEvents, ...upcomingMatchEvents]).slice(0, 6);
  const nextMatch = upcomingMatchEvents.length > 0 ? sortEvents(upcomingMatchEvents)[0] : null;

  const summary = showPresenze
    ? pendingOccurrences.length === 0
      ? "Presenze in pari: nessun allenamento da registrare."
      : pendingOccurrences.length === 1
        ? "C'è un allenamento recente di cui registrare le presenze."
        : `Ci sono ${pendingOccurrences.length} allenamenti recenti di cui registrare le presenze.`
    : `${activeTrainings.length} ${activeTrainings.length === 1 ? "allenamento attivo" : "allenamenti attivi"} in calendario.`;

  return (
    <div>
      {password_changed && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-success/20 bg-success-soft px-4 py-3 text-sm font-medium text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Password aggiornata con successo.
        </div>
      )}

      <header className="mb-7 sm:mb-9">
        <p className="eyebrow">{format(today, "EEEE d MMMM", { locale: it })}</p>
        <h1 className="display-wide mt-2 text-[2rem] leading-[1.05] text-foreground sm:text-[2.5rem]">
          Ciao, {session.fullName.split(" ")[0]}
        </h1>
        <p className="mt-2 text-[15px] text-muted-foreground">{summary}</p>
      </header>

      {officialToConfirm > 0 && (
        <Link
          href="/admin/partite"
          data-tour="dashboard-official-results"
          className="group mb-6 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary-soft px-4 py-3 text-sm font-semibold text-primary transition-colors hover:border-primary/40"
        >
          <Swords className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            {officialToConfirm === 1
              ? "C'è un risultato ufficiale della federazione da confermare."
              : `Ci sono ${officialToConfirm} risultati ufficiali della federazione da confermare.`}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" data-tour="dashboard-stats">
        <StatTile
          href="/admin/allenamenti"
          label="Allenamenti attivi"
          value={activeTrainings.length}
          icon={CalendarClock}
        />
        {showMatches && (
          <StatTile
            href="/admin/partite"
            label="Partite in calendario"
            value={matches.length}
            icon={Swords}
            tone="u15"
            hint={nextMatch ? `Prossima: ${format(parseISO(nextMatch.date), "EEE d MMM", { locale: it })}` : undefined}
          />
        )}
        {showPresenze && (
          <StatTile
            href="/admin/presenze/atlete"
            label="Atlete attive"
            value={activeAthletes.length}
            icon={Users}
            tone="u14"
          />
        )}
        {showPresenze && (
          <StatTile
            href="/admin/presenze"
            label="Presenze da registrare"
            value={pendingOccurrences.length}
            icon={ClipboardCheck}
            tone={pendingOccurrences.length > 0 ? "warning" : "success"}
          />
        )}
      </div>

      <div className="mt-9 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-10">
        <section data-tour="dashboard-upcoming">
          <SectionHeading
            title="Prossimi impegni"
            action={
              <Link href="/admin/allenamenti" className="text-sm font-semibold text-primary hover:underline">
                Calendario
              </Link>
            }
          />
          {upcomingEvents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-strong bg-surface/70 px-6 py-10 text-center text-sm text-muted-foreground">
              {showMatches
                ? "Nessun allenamento o partita in programma nei prossimi giorni."
                : "Nessun allenamento in programma nei prossimi giorni."}
            </div>
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">
              {upcomingEvents.map((event) => {
                const isTraining = event.kind === "training";
                const date = parseISO(event.date);
                const isToday = event.date === todayStr;
                return (
                  <Link
                    key={event.id}
                    href={eventHref(event)}
                    className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-muted sm:px-5"
                  >
                    <span className="w-11 shrink-0 text-center">
                      <span
                        className={cn(
                          "block text-[11px] font-semibold uppercase tracking-[0.06em]",
                          isToday ? "text-primary" : "text-muted-foreground",
                        )}
                      >
                        {isToday ? "Oggi" : format(date, "EEE", { locale: it })}
                      </span>
                      <span
                        className={cn(
                          "display-wide tabular block text-[1.375rem] leading-7",
                          isToday ? "text-primary" : "text-foreground",
                        )}
                      >
                        {format(date, "d")}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "w-1 self-stretch rounded-full",
                        isTraining ? trainingDotClass(event.color) : categoryDotClass(event.category),
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="truncate font-semibold text-foreground group-hover:text-primary">
                          {isTraining ? event.title : matchTitle(event)}
                        </span>
                        {!isTraining && (
                          <span className="text-xs font-semibold text-muted-foreground">
                            {event.category ? CATEGORY_LABELS[event.category] : MATCH_NO_CATEGORY_LABEL}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground">
                        <span className="tabular shrink-0 font-semibold text-foreground/75">
                          {isTraining ? `${event.startTime}–${event.endTime}` : event.time}
                        </span>
                        <MapPin className="ml-1 h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{event.location}</span>
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <div className="space-y-8">
          {showPresenze && (
            <section>
              <SectionHeading
                title="Da registrare"
                action={<span className="text-[13px] text-muted-foreground">Ultimi 21 giorni</span>}
              />
              {pendingOccurrences.length === 0 ? (
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-4 shadow-card">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-success-soft text-success">
                    <CheckCircle2 className="h-5 w-5" />
                  </span>
                  <p className="text-sm font-medium text-foreground/80">Tutto registrato. Ottimo lavoro!</p>
                </div>
              ) : (
                <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                  {pendingOccurrences.slice(0, 4).map((occ) =>
                    occ.kind === "training" ? (
                      <div key={occ.id} className="flex items-center gap-3 px-4 py-3">
                        <span className={cn("h-2 w-2 shrink-0 rounded-full", trainingDotClass(occ.color))} aria-hidden />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">{occ.title}</p>
                          <p className="text-xs text-muted-foreground first-letter:uppercase">
                            {format(parseISO(occ.date), "EEEE d MMMM", { locale: it })}
                          </p>
                        </div>
                        <LinkButton href={`/admin/presenze/registra/${occ.ruleId}/${occ.date}`} variant="soft" size="xs">
                          Registra
                        </LinkButton>
                      </div>
                    ) : null,
                  )}
                  {pendingOccurrences.length > 4 && (
                    <Link
                      href="/admin/presenze"
                      className="block px-4 py-2.5 text-center text-[13px] font-semibold text-primary hover:bg-surface-muted"
                    >
                      Vedi tutti ({pendingOccurrences.length})
                    </Link>
                  )}
                </div>
              )}
            </section>
          )}

          {quickActions.length > 0 && (
            <section>
              <SectionHeading title="Azioni rapide" />
              <div className="grid gap-2">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Link
                      key={action.href}
                      href={action.href}
                      className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground shadow-xs transition-colors hover:border-border-strong hover:bg-surface-muted"
                    >
                      <span className="icon-chip h-8 w-8 rounded-lg shadow-none">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="flex-1">{action.label}</span>
                      <Plus className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
