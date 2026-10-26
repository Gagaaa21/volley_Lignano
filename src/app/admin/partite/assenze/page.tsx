import type { Metadata } from "next";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { BellRing, CalendarX2, ChevronRight, History, Link2, MessageCircle, Settings2 } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { getOwnStaff, requireStaffPage } from "@/lib/auth/guard";
import { matchTitle } from "@/lib/calendar";
import { matchupLabel } from "@/lib/matchNotices";
import { answerWhen } from "@/lib/availability/format";
import { missingAvailabilityTables } from "@/lib/availability/health";
import { isAppSettingsMissing, isAvailabilityTableMissing } from "@/lib/availability/missing";
import { DEFAULT_REPORTING_RULES, reminderMessage, rulesSummary, type MatchReporting, type ReportingRules } from "@/lib/availability/reporting";
import { reportingView, shortWhen } from "@/lib/availability/reportingView";
import { appliesToAthlete, canUseFamilyLink, isAbsence } from "@/lib/availability/rules";
import { ABSENCE_REASON_LABELS, ANSWERED_BY_PHRASES, type AthleteFamilyLink, type MatchAvailability } from "@/lib/availability/types";
import { whatsappShareUrl } from "@/lib/availability/share";
import { nowLocalIso, todayIso } from "@/lib/today";
import type { Athlete, Match } from "@/lib/types";
import { AvailabilityDatabaseNotice } from "@/components/availability/AvailabilityDatabaseNotice";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { CopyTextButton } from "@/components/ui/CopyTextButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { ReportingControls } from "../ReportingControls";
import { RulesForm } from "./RulesForm";

export const metadata: Metadata = {
  title: "Assenze alle partite",
};

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Le letture che possono mancare finché il database non è completo: al loro posto un valore vuoto (lo spiega l'avviso in cima). */
async function orEmpty<T>(read: Promise<T>, empty: T, isMissing: (error: unknown) => boolean): Promise<T> {
  try {
    return await read;
  } catch (error) {
    if (!isMissing(error)) throw error;
    return empty;
  }
}

/**
 * Le assenze alle partite, per l'allenatore e il Developer: per ogni partita in programma come stanno le segnalazioni dei genitori
 * (con i comandi per chiuderle adesso, riaprirle, sceglierne la scadenza, non chiederle o lasciare un messaggio) e chi non ci sarà;
 * poi le ultime segnalazioni, il promemoria da mandare nel gruppo dei genitori e le regole per tutte le partite.
 */
export default async function ReportingPage() {
  const session = await requireStaffPage("partite");
  const isDev = session.role === "dev";
  const repo = await getActiveRepo();
  const now = nowLocalIso();
  const today = todayIso();

  const [missing, allMatches, athletes, canFamilyLinks] = await Promise.all([
    missingAvailabilityTables(repo),
    repo.listMatches({ team: "u14u15", from: today }),
    repo.listAthletes({ team: "u14u15" }),
    isDev ? Promise.resolve(true) : getOwnStaff(session.sub).then((staff) => staff?.allowedPages.includes("presenze") ?? false),
  ]);
  const matches = allMatches
    .filter((match) => match.matchDate.slice(0, 10) >= today && match.setScores === null && match.resultSetsWon === null)
    .sort((a, b) => a.matchDate.localeCompare(b.matchDate));
  const matchIds = matches.map((match) => match.id);

  const [rows, rules, settings, links] = await Promise.all([
    orEmpty<MatchAvailability[]>(repo.listMatchAvailability({ matchIds }), [], isAvailabilityTableMissing),
    orEmpty<ReportingRules>(repo.getReportingRules(), DEFAULT_REPORTING_RULES, isAppSettingsMissing),
    orEmpty<MatchReporting[]>(repo.listMatchReporting(matchIds), [], isAppSettingsMissing),
    orEmpty<AthleteFamilyLink[] | null>(repo.listAthleteFamilyLinks(), null, isAvailabilityTableMissing),
  ]);

  const active = athletes.filter((athlete) => canUseFamilyLink(athlete)).sort((a, b) => a.fullName.localeCompare(b.fullName, "it"));
  const athleteById = new Map(active.map((athlete) => [athlete.id, athlete] as const));
  const settingByMatch = new Map(settings.map((setting) => [setting.matchId, setting] as const));
  const absences = rows.filter(isAbsence).filter((row) => athleteById.has(row.athleteId));
  const matchById = new Map(matches.map((match) => [match.id, match] as const));

  const views = matches.map((match) => ({ match, view: reportingView(match, rules, settingByMatch.get(match.id) ?? null, now) }));
  const openCount = views.filter(({ view }) => view.state.kind === "open").length;

  const reminder = reminderMessage(
    views
      .filter(({ view }) => view.state.kind === "open")
      .map(({ match, view }) => ({
        when: shortWhen(view.start),
        title: matchupLabel(match),
        deadline: view.state.kind === "open" ? shortWhen(view.state.deadline) : "",
      })),
  );
  const recent = [...absences].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8);
  const withLink = links ? active.filter((athlete) => links.some((link) => link.athleteId === athlete.id)).length : null;

  return (
    <div>
      <PageHeader
        back={{ href: "/admin/partite", label: "Partite" }}
        title="Assenze alle partite"
        description="Le segnalazioni dei genitori dal loro link personale: fino a quando si possono fare, partita per partita, e chi non ci sarà. Tu e l'allenatore potete cambiare tutto, sempre."
        actions={
          canFamilyLinks ? (
            <LinkButton href="/admin/presenze/atlete/link-genitori" variant="outline" data-reporting-links>
              <Link2 className="h-4 w-4" />
              Link per i genitori
            </LinkButton>
          ) : undefined
        }
      />

      <AvailabilityDatabaseNotice missing={missing} isDev={isDev} />

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
          <Badge tone={withLink === active.length && active.length > 0 ? "success" : "neutral"}>
            {withLink} su {active.length} atlete con il link
          </Badge>
        )}
        <Badge tone="neutral">Regole: {rulesSummary(rules)}</Badge>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="min-w-0 space-y-4" data-reporting-matches>
          <h2 className="font-display text-lg font-bold text-foreground">Partite in programma</h2>
          {views.length === 0 ? (
            <EmptyState icon={CalendarX2} title="Nessuna partita in programma" description="Quando inserisci le prossime partite le trovi qui." />
          ) : (
            views.map(({ match, view }) => (
              <MatchReportingCard key={match.id} match={match} view={view} athletes={active} absences={absences.filter((row) => row.matchId === match.id)} />
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
                          Segnalata {ANSWERED_BY_PHRASES[row.answeredBy]} · {answerWhen(row.updatedAt)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card data-reporting-reminder>
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
                Regole per tutte le partite
              </CardTitle>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Fino a quando i genitori possono segnalare, se non scegli altro per una partita.
              </p>
            </CardHeader>
            <CardBody>
              <RulesForm
                rules={rules}
                changed={rules.updatedAt ? `Cambiate da ${rules.updatedBy ?? "qualcuno dello staff"} · ${answerWhen(rules.updatedAt)}` : null}
              />
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
}: {
  match: Match;
  view: ReturnType<typeof reportingView>;
  athletes: Athlete[];
  absences: MatchAvailability[];
}) {
  const eligible = athletes.filter((athlete) => appliesToAthlete(match, athlete));
  const names = new Map(eligible.map((athlete) => [athlete.id, athlete.fullName] as const));
  const absent = absences.filter((row) => names.has(row.athleteId));

  return (
    <Card data-reporting-match={match.id}>
      <CardBody className="space-y-4 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-muted-foreground">
              {capitalize(format(parseISO(match.matchDate.slice(0, 10)), "EEEE d MMMM", { locale: it }))} · {match.matchDate.slice(11, 16)}
            </p>
            <Link href={`/admin/partite/${match.id}`} className="group mt-0.5 inline-flex flex-wrap items-center gap-2 font-display text-base font-bold text-foreground hover:text-primary">
              {matchTitle(match)}
              <CategoryTag category={match.category} />
              <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>
          <Badge tone={absent.length > 0 ? "danger" : "neutral"} data-reporting-absent-count={absent.length}>
            {absent.length === 0 ? "Nessuna assenza" : absent.length === 1 ? "1 non c'è" : `${absent.length} non ci sono`} su {eligible.length}
          </Badge>
        </div>

        {absent.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" data-reporting-absent>
            {absent.map((row) => (
              <li
                key={row.athleteId}
                className="rounded-lg bg-destructive/8 px-2.5 py-1 text-[13px] font-semibold text-destructive"
                title={[row.reason ? ABSENCE_REASON_LABELS[row.reason] : null, row.note, `segnalata ${ANSWERED_BY_PHRASES[row.answeredBy]}`].filter(Boolean).join(" · ")}
              >
                {names.get(row.athleteId)}
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-border pt-4">
          <ReportingControls view={view} />
        </div>
      </CardBody>
    </Card>
  );
}
