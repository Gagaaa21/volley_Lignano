import type { Metadata } from "next";
import type { ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { ChevronRight, Clock, MapPin, Target, Trophy } from "lucide-react";
import { getActiveRepo, getRepo } from "@/lib/db";
import { requireStaff, resolveActiveTeam } from "@/lib/auth/guard";
import { matchTitle } from "@/lib/calendar";
import { CATEGORY_LABELS, parseCategoryFilter } from "@/lib/category";
import { formatDateLong } from "@/lib/format";
import {
  arePredictionsClosed,
  computeLeaderboard,
  computeTournamentMatchResults,
  judgedSets,
  matchHasResult,
  predictionClosingLabel,
  predictionClosingSoon,
} from "@/lib/predictions";
import { CategoryFilterLinks } from "@/components/admin/CategoryFilterLinks";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { PageHeader, SectionHeading } from "@/components/ui/PageHeader";
import { cn } from "@/lib/cn";
import { LinkButton } from "@/components/ui/LinkButton";
import Link from "next/link";
import { SectionTour } from "@/components/tour/SectionTour";
import { SECTION_PRONOSTICI_STEPS } from "@/components/tour/sectionSteps";
import { Leaderboard, MatchPointsChips, PredictionSummary, ResultLegend, ResultTable, ScoringRules } from "./PredictionViews";
import type { Match, MatchPrediction } from "@/lib/types";

export const metadata: Metadata = {
  title: "Pronostici",
};

export default async function PronosticiPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const session = await requireStaff();
  const team = await resolveActiveTeam(session);
  const { cat } = await searchParams;
  // Under 14 e Under 15 si possono guardare una alla volta (le partite in elenco; la classifica resta su tutte).
  const category = team === "u14u15" ? parseCategoryFilter(cat) : "all";

  const [repo, staffRepo] = await Promise.all([getActiveRepo(), getRepo()]);
  const [allMatches, allPredictions, staff] = await Promise.all([
    repo.listMatches({ team }),
    repo.listPredictions(),
    staffRepo.listStaff(),
  ]);
  const matches = allMatches.filter((m) => category === "all" || m.category === category);
  const byDate = (a: Match, b: Match) => a.matchDate.localeCompare(b.matchDate);

  const nameById = new Map(staff.map((s) => [s.id, s.fullName]));
  const meId = session.sub;

  const predictionsByMatch = new Map<string, MatchPrediction[]>();
  for (const prediction of allPredictions) {
    const list = predictionsByMatch.get(prediction.matchId) ?? [];
    list.push(prediction);
    predictionsByMatch.set(prediction.matchId, list);
  }

  // Da pronosticare: la più vicina in cima. Risultati: la più recente in cima.
  const upcoming = matches.filter((m) => !arePredictionsClosed(m)).sort(byDate);
  const lockedNoResult = matches.filter((m) => arePredictionsClosed(m) && !matchHasResult(m)).sort(byDate);
  const withResult = matches.filter((m) => matchHasResult(m)).sort((a, b) => byDate(b, a));

  // La classifica conta sempre tutte le partite, qualunque categoria si stia guardando.
  const leaderboard = computeLeaderboard(allMatches.filter((m) => matchHasResult(m)), predictionsByMatch);

  return (
    <div>
      <PageHeader
        title="Pronostici"
        description="Pronostica il punteggio di ogni set: chi si avvicina di più vince il set. A fine stagione vince chi ha più punti."
        help={<SectionTour steps={SECTION_PRONOSTICI_STEPS} />}
      />

      {team === "u14u15" && <CategoryFilterLinks path="/admin/pronostici" active={category} className="mb-6" dataTour="section-pronostici-filter" />}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-10">
        <div className="min-w-0 space-y-9">
          <section data-tour="section-pronostici-open">
            <SectionHeading title="Da pronosticare" />
            {upcoming.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border-strong bg-surface/70 px-6 py-10 text-center text-sm text-muted-foreground">
                {category === "all" ? "Nessuna partita in programma al momento." : `Nessuna partita ${CATEGORY_LABELS[category]} in programma al momento.`}
              </div>
            ) : (
              <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                {upcoming.map((match) => {
                  const matchPredictions = predictionsByMatch.get(match.id) ?? [];
                  const mine = matchPredictions.find((p) => p.staffId === meId);
                  const others = matchPredictions.filter((p) => p.staffId !== meId).map((p) => nameById.get(p.staffId) ?? "Utente rimosso");
                  const soon = predictionClosingSoon(match.matchDate);
                  return (
                    <MatchRow
                      key={match.id}
                      match={match}
                      status={
                        <div className="mt-1.5 space-y-1.5">
                          <p
                            className={cn("inline-flex items-center gap-1 text-xs font-semibold", soon ? "text-warning" : "text-muted-foreground")}
                            data-prediction-closing
                          >
                            <Clock className="h-3.5 w-3.5" />
                            Si chiude {predictionClosingLabel(match.matchDate)}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 text-xs" data-my-prediction={mine ? "yes" : "no"}>
                            {mine ? (
                              <>
                                <span className="font-semibold text-foreground/80">Il tuo:</span>
                                <PredictionSummary prediction={mine} />
                              </>
                            ) : (
                              <span className="font-semibold text-primary">Non hai ancora pronosticato</span>
                            )}
                          </div>
                          {others.length > 0 && (
                            <p className="text-xs text-muted-foreground" data-others-predicted>
                              {mine ? "Anche " : "Hanno pronosticato "}
                              <span className="font-semibold text-foreground/80">{others.join(", ")}</span>
                            </p>
                          )}
                        </div>
                      }
                      action={
                        <LinkButton href={`/admin/pronostici/${match.id}`} variant={mine ? "outline" : "primary"} size="sm">
                          <Target className="h-3.5 w-3.5" />
                          {mine ? "Modifica" : "Pronostica"}
                        </LinkButton>
                      }
                    />
                  );
                })}
              </div>
            )}
          </section>

          {lockedNoResult.length > 0 && (
            <section>
              <SectionHeading title="In attesa del risultato" />
              <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                {lockedNoResult.map((match) => {
                  const count = (predictionsByMatch.get(match.id) ?? []).length;
                  return (
                    <MatchRow
                      key={match.id}
                      match={match}
                      status={
                        <p className="mt-1 text-xs font-semibold text-muted-foreground">
                          {count === 0 ? "Nessun pronostico" : `${count} pronostic${count === 1 ? "o" : "i"}, ora visibili a tutti`}
                        </p>
                      }
                      action={
                        <LinkButton href={`/admin/pronostici/${match.id}`} variant="outline" size="sm">
                          Vedi pronostici
                        </LinkButton>
                      }
                    />
                  );
                })}
              </div>
            </section>
          )}

          {withResult.length > 0 && (
            <section data-tour="section-pronostici-results">
              <SectionHeading title="Risultati" />
              <div className="space-y-4">
                {withResult.map((match, i) => (
                  <MatchResultCard
                    key={match.id}
                    match={match}
                    predictions={predictionsByMatch.get(match.id) ?? []}
                    nameById={nameById}
                    meId={meId}
                    expanded={i === 0}
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        <aside data-tour="section-pronostici-leaderboard">
          <SectionHeading title="Classifica" />
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            {leaderboard.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-8 text-center">
                <span className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-accent text-accent-foreground">
                  <Trophy className="h-5 w-5" />
                </span>
                <p className="text-sm text-muted-foreground">
                  Nessun set ancora giudicato: la classifica si popola man mano che arrivano i risultati.
                </p>
              </div>
            ) : (
              <Leaderboard entries={leaderboard} nameById={nameById} meId={meId} />
            )}
          </div>
          <ScoringRules />
        </aside>
      </div>
    </div>
  );
}

function MatchRow({ match, status, action }: { match: Match; status?: ReactNode; action: ReactNode }) {
  const date = parseISO(match.matchDate.slice(0, 10));
  return (
    <div className="flex flex-col px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <span className="w-11 shrink-0 text-center">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            {format(date, "EEE", { locale: it })}
          </span>
          <span className="display-wide tabular block text-[1.375rem] leading-7 text-foreground">{format(date, "d")}</span>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            {format(date, "MMM", { locale: it })}
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-2">
            <span className="truncate font-semibold text-foreground">{matchTitle(match)}</span>
            <CategoryTag category={match.category} long />
          </p>
          <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground">
            <span className="tabular shrink-0 font-semibold text-foreground/75">{match.matchDate.slice(11, 16)}</span>
            <MapPin className="ml-1 h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{match.location}</span>
          </p>
          {status}
        </div>
      </div>
      <div className="mt-2.5 pl-[3.75rem] sm:mt-0 sm:pl-0">{action}</div>
    </div>
  );
}

/** Il risultato vero in breve: «Vinta 3–1» o «Persa 1–3»; per un torneo il numero di gare. */
function actualOutcome(match: Match): { label: string; won: boolean | null } {
  if (match.isTournament) {
    const games = (match.tournamentGames ?? []).filter((g) => g.setScores.length > 0).length;
    return { label: `Torneo · ${games} gar${games === 1 ? "a" : "e"}`, won: null };
  }
  const won = match.resultSetsWon ?? 0;
  const lost = match.resultSetsLost ?? 0;
  return { label: `${won > lost ? "Vinta" : "Persa"} ${won}–${lost}`, won: won > lost };
}

/**
 * Una partita con il risultato: in testa il risultato vero; la più recente con tutta la tabella (pronostici set per set e
 * punti), le altre con i punti di ognuno in breve e il collegamento al confronto completo.
 */
function MatchResultCard({
  match,
  predictions,
  nameById,
  meId,
  expanded,
}: {
  match: Match;
  predictions: MatchPrediction[];
  nameById: Map<string, string>;
  meId: string;
  expanded: boolean;
}) {
  const outcome = actualOutcome(match);
  const sets = judgedSets(match, predictions);
  const tournament = match.isTournament ? (computeTournamentMatchResults(match, predictions) ?? []) : [];
  return (
    <Card data-prediction-result={match.id}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-display text-base font-bold text-foreground">
              {matchTitle(match)}
              <CategoryTag category={match.category} long />
            </p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{formatDateLong(match.matchDate.slice(0, 10))}</p>
          </div>
          <span
            className={cn(
              "tabular shrink-0 rounded-full px-2.5 py-1 text-xs font-bold",
              outcome.won === null ? "bg-muted text-foreground/80" : outcome.won ? "bg-success-soft text-success" : "bg-muted text-foreground/80",
            )}
          >
            {outcome.label}
          </span>
        </div>
      </CardHeader>
      <CardBody className="space-y-3">
        {expanded ? (
          match.isTournament ? (
            tournament.map((game) => (
              <ResultTable key={game.gameId} sets={game.sets} nameById={nameById} meId={meId} label={`vs ${game.opponent}`} />
            ))
          ) : (
            <ResultTable sets={sets} nameById={nameById} meId={meId} />
          )
        ) : (
          <MatchPointsChips sets={sets} nameById={nameById} meId={meId} />
        )}
        {expanded && sets.some((set) => set.rankings.length > 0) && <ResultLegend />}
        <Link
          href={`/admin/pronostici/${match.id}`}
          className="inline-flex items-center gap-0.5 text-[13px] font-semibold text-primary hover:underline"
        >
          {expanded ? "Apri la scheda" : "Confronto set per set"}
          <ChevronRight className="h-4 w-4" />
        </Link>
      </CardBody>
    </Card>
  );
}
