import type { Metadata } from "next";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { BellRing, CalendarX2, ChevronRight, History, MessageCircle, Settings2, UserX } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guard";
import { matchTitle } from "@/lib/calendar";
import { matchupLabel } from "@/lib/matchNotices";
import { answerWhen } from "@/lib/availability/format";
import { missingAvailabilityTables } from "@/lib/availability/health";
import { isAvailabilityTableMissing } from "@/lib/availability/missing";
import { reminderMessage, rulesSummary } from "@/lib/availability/reporting";
import { reportingView, shortWhen, type ReportingView } from "@/lib/availability/reportingView";
import { answeredByPhrase, appliesToAthlete, canUseFamilyLink, isAbsence, staffNamesById } from "@/lib/availability/rules";
import { ABSENCE_REASON_LABELS, type AthleteFamilyLink, type MatchAvailability } from "@/lib/availability/types";
import { whatsappShareUrl } from "@/lib/availability/share";
import { nowLocalIso, todayIso } from "@/lib/today";
import type { Athlete, Match } from "@/lib/types";
import { AvailabilityDatabaseNotice } from "@/components/availability/AvailabilityDatabaseNotice";
import { SectionTour } from "@/components/tour/SectionTour";
import { SECTION_ASSENZE_STEPS } from "@/components/tour/sectionSteps";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { CopyTextButton } from "@/components/ui/CopyTextButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { AssenzeTabs } from "./AssenzeTabs";
import { ReportingControls } from "./ReportingControls";
import { loadReporting, orEmpty } from "./load";

export const metadata: Metadata = {
  title: "Assenze",
};

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * La sezione Assenze, per l'allenatore e il Developer (permesso «Partite», solo U14/U15): per ogni partita in programma come stanno
 * le segnalazioni dei genitori (con i comandi per chiuderle adesso, riaprirle, sceglierne la scadenza, non chiederle o lasciare un
 * messaggio) e chi non ci sarà, con la pagina della partita per segnarlo; accanto le ultime segnalazioni e il promemoria da mandare
 * nel gruppo dei genitori. Link per i genitori e regole hanno la loro parte (vedi AssenzeTabs).
 */
export default async function AssenzePage() {
  const session = await requireStaffPage("partite");
  const repo = await getActiveRepo();
  const now = nowLocalIso();
  const today = todayIso();

  const [missing, allMatches, athletes, staff] = await Promise.all([
    missingAvailabilityTables(repo),
    repo.listMatches({ team: "u14u15", from: today }),
    repo.listAthletes({ team: "u14u15" }),
    repo.listStaff(),
  ]);
  const staffNames = staffNamesById(staff);
  const author = (row: MatchAvailability) => answeredByPhrase(row.answeredBy, row.updatedBy ? staffNames.get(row.updatedBy) : null);
  const matches = allMatches
    .filter((match) => match.matchDate.slice(0, 10) >= today && match.setScores === null && match.resultSetsWon === null)
    .sort((a, b) => a.matchDate.localeCompare(b.matchDate));
  const matchIds = matches.map((match) => match.id);

  const [rows, { rules, settings }, links] = await Promise.all([
    orEmpty<MatchAvailability[]>(repo.listMatchAvailability({ matchIds }), [], isAvailabilityTableMissing),
    loadReporting(repo, matchIds),
    orEmpty<AthleteFamilyLink[] | null>(repo.listAthleteFamilyLinks(), null, isAvailabilityTableMissing),
  ]);

  const active = athletes.filter((athlete) => canUseFamilyLink(athlete)).sort((a, b) => a.fullName.localeCompare(b.fullName, "it"));
  const athleteById = new Map(active.map((athlete) => [athlete.id, athlete] as const));
  const absences = rows.filter(isAbsence).filter((row) => athleteById.has(row.athleteId));
  const matchById = new Map(matches.map((match) => [match.id, match] as const));

  const views = matches.map((match) => ({ match, view: reportingView(match, rules, settings.get(match.id) ?? null, now) }));
  const openCount = views.filter(({ view }) => view.state.kind === "open").length;
  const reminder = reminderMessage(
    views.flatMap(({ match, view }) =>
      view.state.kind === "open" ? [{ when: shortWhen(view.start), title: matchupLabel(match), deadline: shortWhen(view.state.deadline) }] : [],
    ),
  );
  const recent = [...absences].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8);
  const withLink = links ? active.filter((athlete) => links.some((link) => link.athleteId === athlete.id)).length : null;

  return (
    <div>
      <PageHeader
        title="Assenze"
        description="Le partite a cui un'atleta non ci sarà: le segnalano i genitori dal loro link personale, fino alla scadenza, oppure lo staff, sempre. Qui si decide fino a quando si può segnalare, partita per partita, e chi cambia qualcosa si vede con il suo nome."
        help={<SectionTour steps={SECTION_ASSENZE_STEPS} />}
      />
      <AssenzeTabs active="partite" />

      <AvailabilityDatabaseNotice missing={missing} isDev={session.role === "dev"} />

      {session.role === "dev" && session.testMode && (
        <p className="mb-6 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-foreground">
          Sei in modalità prova: quello che cambi qui resta nella prova e i genitori non lo vedono.
        </p>
      )}

      <div className="mb-6 flex flex-wrap gap-2" data-reporting-summary>
        <Badge tone={rules.paused ? "warning" : openCount > 0 ? "success" : "neutral"} data-reporting-summary-open>
          {rules.paused ? "Segnalazioni sospese per tutte" : `${openCount} ${openCount === 1 ? "partita aperta" : "partite aperte"} su ${matches.length}`}
        </Badge>
        <Badge tone={absences.length > 0 ? "danger" : "neutral"}>
          {absences.length === 0 ? "Nessuna assenza segnalata" : absences.length === 1 ? "1 assenza segnalata" : `${absences.length} assenze segnalate`}
        </Badge>
        {withLink !== null && (
          <Link href="/admin/assenze/link">
            <Badge tone={withLink === active.length && active.length > 0 ? "success" : "neutral"}>
              {withLink} su {active.length} atlete con il link
            </Badge>
          </Link>
        )}
        <Link href="/admin/assenze/regole">
          <Badge tone="neutral">Regole: {rulesSummary(rules)}</Badge>
        </Link>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="min-w-0 space-y-4" data-reporting-matches data-tour="section-assenze-matches">
          <h2 className="font-display text-lg font-bold text-foreground">Partite in programma</h2>
          {views.length === 0 ? (
            <EmptyState icon={CalendarX2} title="Nessuna partita in programma" description="Quando inserisci le prossime partite le trovi qui." />
          ) : (
            views.map(({ match, view }) => (
              <MatchReportingCard
                key={match.id}
                match={match}
                view={view}
                athletes={active}
                absences={absences.filter((row) => row.matchId === match.id)}
                author={author}
              />
            ))
          )}
        </section>

        <aside className="min-w-0 space-y-6">
          <Card data-reporting-recent>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <History className="h-4 w-4 text-primary" aria-hidden />
                Ultime segnalazioni
              </CardTitle>
            </CardHeader>
            <CardBody>
              {recent.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ancora nessuna assenza per le prossime partite.</p>
              ) : (
                <ul className="space-y-3">
                  {recent.map((row) => {
                    const match = matchById.get(row.matchId);
                    return (
                      <li key={`${row.matchId}-${row.athleteId}`} className="text-sm" data-reporting-recent-row>
                        <p className="font-semibold text-foreground">{athleteById.get(row.athleteId)?.fullName}</p>
                        <p className="text-[13px] text-foreground/75">
                          Non ci sarà{match ? ` · ${matchTitle(match)} (${shortWhen(match.matchDate.slice(0, 16))})` : ""}
                          {row.reason ? ` · ${ABSENCE_REASON_LABELS[row.reason]}` : ""}
                          {row.note ? ` · ${row.note}` : ""}
                        </p>
                        <p className="text-[12px] text-muted-foreground">
                          Segnalata {author(row)} · {answerWhen(row.updatedAt)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card data-reporting-reminder data-tour="section-assenze-reminder">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <BellRing className="h-4 w-4 text-primary" aria-hidden />
                Promemoria per il gruppo
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              {reminder ? (
                <>
                  <p className="whitespace-pre-line rounded-xl bg-surface-muted px-3.5 py-3 text-[13px] leading-relaxed text-foreground/85" data-reporting-reminder-text>
                    {reminder}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <CopyTextButton text={reminder} data-reporting-reminder-copy>
                      Copia
                    </CopyTextButton>
                    <LinkButton href={whatsappShareUrl(null, reminder)} target="_blank" rel="noopener noreferrer" size="sm" variant="soft">
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </LinkButton>
                  </div>
                  <p className="text-[12px] text-muted-foreground">Solo partite e scadenze: mai nomi né link (ogni famiglia ha il suo).</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Nessuna partita con le segnalazioni aperte: per ora non c&apos;è niente da ricordare.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-primary" aria-hidden />
                Regole
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-3 text-sm text-foreground/80">
              <p>
                Le segnalazioni si chiudono da sole <b className="font-semibold text-foreground">{rulesSummary(rules)}</b>
                {rules.paused ? ", ma ora sono sospese per tutte le partite" : ""}.
              </p>
              <LinkButton href="/admin/assenze/regole" size="sm" variant="outline">
                Cambia le regole
              </LinkButton>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function MatchReportingCard({
  match,
  view,
  athletes,
  absences,
  author,
}: {
  match: Match;
  view: ReportingView;
  athletes: Athlete[];
  absences: MatchAvailability[];
  /** «dal genitore» / «da Gaga». */
  author: (row: MatchAvailability) => string;
}) {
  const eligible = athletes.filter((athlete) => appliesToAthlete(match, athlete));
  const names = new Map(eligible.map((athlete) => [athlete.id, athlete.fullName] as const));
  const absent = absences.filter((row) => names.has(row.athleteId));
  const href = `/admin/assenze/partita/${match.id}`;

  return (
    <Card data-reporting-match={match.id}>
      <CardBody className="space-y-4 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-muted-foreground">
              {capitalize(format(parseISO(match.matchDate.slice(0, 10)), "EEEE d MMMM", { locale: it }))} · {match.matchDate.slice(11, 16)}
            </p>
            <Link href={href} className="group mt-0.5 inline-flex flex-wrap items-center gap-2 font-display text-base font-bold text-foreground hover:text-primary">
              {matchTitle(match)}
              <CategoryTag category={match.category} />
              <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>
          <Badge tone={absent.length > 0 ? "danger" : "neutral"} data-reporting-absent-count={absent.length}>
            {absent.length === 0 ? "Nessuna assenza" : absent.length === 1 ? "1 non c'è" : `${absent.length} non ci sono`} su {eligible.length}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {absent.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" data-reporting-absent>
              {absent.map((row) => (
                <li
                  key={row.athleteId}
                  className="rounded-lg bg-destructive/8 px-2.5 py-1 text-[13px] font-semibold text-destructive"
                  title={[row.reason ? ABSENCE_REASON_LABELS[row.reason] : null, row.note, `segnalata ${author(row)}`].filter(Boolean).join(" · ")}
                >
                  {names.get(row.athleteId)}
                </li>
              ))}
            </ul>
          )}
          <Link href={href} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[13px] font-semibold text-primary hover:bg-primary-soft" data-reporting-open-match>
            <UserX className="h-3.5 w-3.5" aria-hidden />
            Segna chi non ci sarà
          </Link>
        </div>

        <div className="border-t border-border pt-4">
          <ReportingControls view={view} />
        </div>
      </CardBody>
    </Card>
  );
}
