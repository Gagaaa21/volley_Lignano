import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { addDays, format, subDays } from "date-fns";
import { it } from "date-fns/locale";
import {
  AlertCircle,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Dumbbell,
  MapPin,
  Puzzle,
  Swords,
  Users,
} from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { requireStaff } from "@/lib/auth/guard";
import { expandTrainings, matchTitle, matchesToEvents, sortEvents } from "@/lib/calendar";
import { CATEGORY_BADGE, CATEGORY_LABELS, TRAINING_BADGE } from "@/lib/category";
import { cn } from "@/lib/cn";
import { CardBody } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import crest from "@/assets/lignano-crest.png";
import type { CalendarEvent } from "@/lib/types";

export const metadata: Metadata = {
  title: "Dashboard",
};

const SECTIONS = [
  {
    href: "/admin/allenamenti",
    label: "Allenamenti",
    description: "Calendario, regole e schede per data",
    icon: CalendarClock,
  },
  {
    href: "/admin/partite",
    label: "Partite",
    description: "Calendario partite per categoria",
    icon: Swords,
  },
  {
    href: "/admin/schede",
    label: "Schede",
    description: "Blocchi e schede allenamento",
    icon: Puzzle,
  },
  {
    href: "/admin/presenze",
    label: "Presenze",
    description: "Registro e anagrafica atlete",
    icon: ClipboardCheck,
  },
  {
    href: "/admin/staff",
    label: "Staff",
    description: "Account Developer e Admin",
    icon: Users,
  },
  {
    href: "/admin/guida",
    label: "Guida",
    description: "Come funziona il sito",
    icon: BookOpen,
  },
];

function eventHref(event: CalendarEvent) {
  return event.kind === "training" ? `/admin/allenamenti/${event.ruleId}` : `/admin/partite/${event.id}`;
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ password_changed?: string }>;
}) {
  const session = await requireStaff();
  const { password_changed } = await searchParams;
  const repo = await getActiveRepo();

  // La dashboard mostra la squadra U14/U15 (Minivolley ha la propria sezione,
  // senza presenze da registrare): niente allenamenti/tornei Minivolley nel
  // conteggio "Allenamenti attivi" né tra le presenze da registrare.
  const [trainings, matches, athletes, attendanceSessions] = await Promise.all([
    repo.listTrainings({ team: "u14u15" }),
    repo.listMatches(),
    repo.listAthletes(),
    repo.listAttendanceSessions(),
  ]);

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  const activeTrainings = trainings.filter((t) => t.isActive);
  const activeAthletes = athletes.filter((a) => a.isActive);

  const recordedKeys = new Set(attendanceSessions.map((s) => `${s.trainingRuleId}_${s.sessionDate}`));
  const pendingOccurrences = expandTrainings(trainings, subDays(today, 21), today).filter(
    (o) => o.kind === "training" && !recordedKeys.has(`${o.ruleId}_${o.date}`),
  );

  const upcomingTrainingEvents = expandTrainings(trainings, today, addDays(today, 60));
  const upcomingMatchEvents = matchesToEvents(matches).filter((e) => e.date >= todayStr);
  const upcomingEvents = sortEvents([...upcomingTrainingEvents, ...upcomingMatchEvents]).slice(0, 5);

  return (
    <div>
      {password_changed && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-[var(--color-u14)]/30 bg-[var(--color-u14-soft)] px-4 py-3 text-sm font-medium text-[var(--color-u14-strong)]">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Password aggiornata con successo.
        </div>
      )}

      <div className="relative overflow-hidden rounded-2xl border border-border-subtle bg-gradient-to-br from-sea-600 to-sea-800 px-5 py-6 text-white shadow-[0_20px_44px_-26px_rgba(9,27,38,0.55)] sm:px-7 sm:py-7">
        <Image
          src={crest}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 select-none object-contain opacity-[0.12] sm:h-56 sm:w-56"
        />
        <div className="relative z-10">
          <p className="eyebrow eyebrow-inverted capitalize">{format(today, "EEEE d MMMM yyyy", { locale: it })}</p>
          <h1 className="mt-1.5 font-display text-2xl font-bold sm:text-3xl">Ciao, {session.fullName}</h1>
          <p className="mt-1 text-sm text-sea-100/80">Ecco una panoramica di Volley Lignano.</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
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
              <span className="icon-chip bg-[linear-gradient(135deg,var(--color-u15),var(--color-u15-strong))]">
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
              <span className="icon-chip bg-[linear-gradient(135deg,var(--color-u14),var(--color-u14-strong))]">
                <Users className="h-5 w-5" />
              </span>
              <div>
                <p className="text-2xl font-bold text-foreground">{activeAthletes.length}</p>
                <p className="text-xs text-muted-foreground">Atlete attive</p>
              </div>
            </div>
          </CardBody>
        </div>
        <Link href="/admin/presenze" className="stat-card block">
          <CardBody className="pt-5">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "icon-chip",
                  pendingOccurrences.length > 0 && "bg-[linear-gradient(135deg,var(--color-sand-500),var(--color-sand-700))]",
                )}
              >
                <ClipboardCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="text-2xl font-bold text-foreground">{pendingOccurrences.length}</p>
                <p className="text-xs text-muted-foreground">Presenze da registrare</p>
              </div>
            </div>
          </CardBody>
        </Link>
      </div>

      {pendingOccurrences.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-sand-300)] bg-[var(--color-sand-100)] px-4 py-3 text-sm text-[var(--color-sand-800)]">
          <p className="flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {pendingOccurrences.length === 1
              ? "C'è un allenamento senza presenze registrate."
              : `Ci sono ${pendingOccurrences.length} allenamenti senza presenze registrate.`}
          </p>
          <LinkButton href="/admin/presenze" size="sm" variant="secondary">
            Registra ora
          </LinkButton>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="eyebrow">Prossimi impegni</p>
          <h2 className="mt-1.5 font-display text-lg font-bold text-foreground">Cosa c&apos;è in arrivo</h2>

          {upcomingEvents.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-border-subtle bg-surface px-6 py-10 text-center text-sm text-muted-foreground">
              Nessun allenamento o partita in programma nei prossimi giorni.
            </div>
          ) : (
            <div className="mt-4 space-y-2.5">
              {upcomingEvents.map((event) => {
                const isTraining = event.kind === "training";
                const badgeClass = isTraining ? TRAINING_BADGE : CATEGORY_BADGE[event.category];
                return (
                  <Link
                    key={event.id}
                    href={eventHref(event)}
                    className="flex items-center gap-3.5 rounded-xl border border-border-subtle bg-surface px-4 py-3.5 shadow-sm shadow-sea-950/5 transition-colors hover:border-primary/25 hover:bg-primary/[0.03]"
                  >
                    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", badgeClass)}>
                      {isTraining ? <Dumbbell className="h-4.5 w-4.5" /> : <Swords className="h-4.5 w-4.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold text-foreground">
                          {isTraining ? event.title : matchTitle(event)}
                        </p>
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", badgeClass)}>
                          {isTraining ? "U14 · U15" : CATEGORY_LABELS[event.category]}
                        </span>
                      </div>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-foreground/60">
                        <span className="font-medium capitalize text-foreground/80">
                          {format(new Date(event.date), "EEE d MMM", { locale: it })}
                        </span>
                        <span aria-hidden>·</span>
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        {isTraining ? `${event.startTime}–${event.endTime}` : event.time}
                        <span aria-hidden>·</span>
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{event.location}</span>
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-foreground/30" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <p className="eyebrow">Sezioni</p>
          <h2 className="mt-1.5 font-display text-lg font-bold text-foreground">Aree dell&apos;app</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              return (
                <Link key={section.href} href={section.href} className="section-card">
                  <CardBody className="pt-6">
                    <span className="icon-chip">
                      <Icon className="h-5 w-5" />
                    </span>
                    <p className="mt-3 font-display text-sm font-bold text-foreground">{section.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{section.description}</p>
                  </CardBody>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
