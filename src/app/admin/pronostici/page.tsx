import type { Metadata } from "next";
import type { ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Lock, MapPin, Target, Trophy } from "lucide-react";
import { getActiveRepo, getRepo } from "@/lib/db";
import { requireStaff, resolveActiveTeam } from "@/lib/auth/guard";
import { matchTitle } from "@/lib/calendar";
import { formatDateLong } from "@/lib/format";
import {
  computeLeaderboard,
  computeMatchResults,
  computeTournamentMatchResults,
  isMatchDayToday,
  isMatchLocked,
  matchHasResult,
} from "@/lib/predictions";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader, SectionHeading } from "@/components/ui/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import { LinkButton } from "@/components/ui/LinkButton";
import { SectionTour } from "@/components/tour/SectionTour";
import { SECTION_PRONOSTICI_STEPS } from "@/components/tour/sectionSteps";
import { SetRankingBadges } from "./PredictionRankings";
import type { Match, MatchPrediction } from "@/lib/types";

export const metadata: Metadata = {
  title: "Pronostici",
};

export default async function PronosticiPage() {
  const session = await requireStaff();
  const team = await resolveActiveTeam(session);

  const [repo, staffRepo] = await Promise.all([getActiveRepo(), getRepo()]);
  const [matches, allPredictions, staff] = await Promise.all([
    repo.listMatches({ team }),
    repo.listPredictions(),
    staffRepo.listStaff(),
  ]);

  const nameById = new Map(staff.map((s) => [s.id, s.fullName]));

  const predictionsByMatch = new Map<string, MatchPrediction[]>();
  for (const prediction of allPredictions) {
    const list = predictionsByMatch.get(prediction.matchId) ?? [];
    list.push(prediction);
    predictionsByMatch.set(prediction.matchId, list);
  }

  const withResult = matches.filter((m) => matchHasResult(m));
  const upcoming = matches.filter((m) => !isMatchLocked(m.matchDate));
  const lockedNoResult = matches.filter((m) => isMatchLocked(m.matchDate) && !matchHasResult(m));

  const leaderboard = computeLeaderboard(withResult, predictionsByMatch);

  return (
    <div>
      <PageHeader
        title="Pronostici"
        description="Pronostica il punteggio di ogni set: chi si avvicina di più vince il set. A fine stagione vince chi ha più punti."
        help={<SectionTour steps={SECTION_PRONOSTICI_STEPS} />}
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-10">
        <div className="min-w-0 space-y-9">
          <section data-tour="section-pronostici-open">
            <SectionHeading title="Da pronosticare" />
            {upcoming.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border-strong bg-surface/70 px-6 py-10 text-center text-sm text-muted-foreground">
                Nessuna partita in programma al momento.
              </div>
            ) : (
              <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                {upcoming.map((match) => {
                  const matchPredictions = predictionsByMatch.get(match.id) ?? [];
                  const mine = matchPredictions.find((p) => p.staffId === session.sub);
                  const count = matchPredictions.length;
                  const openToday = isMatchDayToday(match.matchDate);
                  return (
                    <MatchRow
                      key={match.id}
                      match={match}
                      status={
                        <p className={cn("mt-1 text-xs font-semibold", openToday ? "text-success" : "text-muted-foreground")}>
                          {openToday ? (
                            count === 0 ? (
                              "Aperto oggi · nessun pronostico ancora"
                            ) : (
                              `Aperto oggi · ${count} pronostic${count === 1 ? "o" : "i"}`
                            )
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <Lock className="h-3 w-3" />
                              Si apre il giorno della partita
                            </span>
                          )}
                        </p>
                      }
                      action={
                        <LinkButton
                          href={`/admin/pronostici/${match.id}`}
                          variant={openToday && !mine ? "primary" : "outline"}
                          size="sm"
                        >
                          <Target className="h-3.5 w-3.5" />
                          {openToday ? (mine ? "Modifica" : "Pronostica") : "Dettagli"}
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
                {lockedNoResult.map((match) => (
                  <MatchRow
                    key={match.id}
                    match={match}
                    action={
                      <LinkButton href={`/admin/pronostici/${match.id}`} variant="outline" size="sm">
                        Vedi pronostici
                      </LinkButton>
                    }
                  />
                ))}
              </div>
            </section>
          )}

          {withResult.length > 0 && (
            <section data-tour="section-pronostici-results">
              <SectionHeading title="Risultati" />
              <div className="space-y-4">
                {withResult.map((match) => (
                  <MatchResultCard
                    key={match.id}
                    match={match}
                    predictions={predictionsByMatch.get(match.id) ?? []}
                    nameById={nameById}
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
                <span className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-sand-100 text-sand-700">
                  <Trophy className="h-5 w-5" />
                </span>
                <p className="text-sm text-muted-foreground">
                  Nessun set ancora giudicato: la classifica si popola man mano che arrivano i risultati.
                </p>
              </div>
            ) : (
              <ol className="divide-y divide-border">
                {leaderboard.map((entry, i) => {
                  const name = nameById.get(entry.staffId) ?? "Utente rimosso";
                  return (
                    <li key={entry.staffId} className={cn("flex items-center gap-3 px-4 py-3", i === 0 && "bg-sand-50")}>
                      <span
                        className={cn(
                          "tabular grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold",
                          i === 0
                            ? "bg-sand-400 text-sea-950"
                            : i === 1
                              ? "bg-muted text-foreground/80 ring-1 ring-border-strong"
                              : i === 2
                                ? "bg-sand-100 text-sand-800"
                                : "text-muted-foreground",
                        )}
                      >
                        {i + 1}
                      </span>
                      <Avatar name={name} size="sm" tone={i === 0 ? "gold" : "neutral"} />
                      <span className="min-w-0 flex-1 truncate font-semibold text-foreground">{name}</span>
                      <span className="tabular shrink-0 text-right">
                        <span className="font-display text-lg font-bold text-foreground">{entry.points}</span>
                        <span className="ml-1 text-xs text-muted-foreground">pt</span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
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
          <p className="truncate font-semibold text-foreground">{matchTitle(match)}</p>
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

function MatchResultCard({
  match,
  predictions,
  nameById,
}: {
  match: Match;
  predictions: MatchPrediction[];
  nameById: Map<string, string>;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-display text-base font-bold text-foreground">{matchTitle(match)}</p>
          <p className="text-[13px] text-muted-foreground">{formatDateLong(match.matchDate.slice(0, 10))}</p>
        </div>
      </CardHeader>
      <CardBody>
        {match.isTournament ? (
          <TournamentResultBlock match={match} predictions={predictions} nameById={nameById} />
        ) : (
          <MatchResultBlock match={match} predictions={predictions} nameById={nameById} />
        )}
      </CardBody>
    </Card>
  );
}

function MatchResultBlock({
  match,
  predictions,
  nameById,
}: {
  match: Match;
  predictions: MatchPrediction[];
  nameById: Map<string, string>;
}) {
  const results = computeMatchResults(match, predictions);
  const hasAnyPrediction = results?.some((r) => r.rankings.length > 0) ?? false;
  if (!results || !hasAnyPrediction) {
    return <p className="text-sm text-muted-foreground">Nessun pronostico per questa partita.</p>;
  }
  return (
    <div className="space-y-2">
      {results
        .filter((r) => r.rankings.length > 0)
        .map((r) => (
          <div key={r.setIndex} className="rounded-xl bg-surface-muted px-3.5 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Set {r.setIndex + 1} · <span className="tabular text-foreground">{r.actual.us}–{r.actual.them}</span>
            </p>
            <SetRankingBadges rankings={r.rankings} nameById={nameById} />
          </div>
        ))}
    </div>
  );
}

function TournamentResultBlock({
  match,
  predictions,
  nameById,
}: {
  match: Match;
  predictions: MatchPrediction[];
  nameById: Map<string, string>;
}) {
  const gameResults = computeTournamentMatchResults(match, predictions) ?? [];
  const playedGames = gameResults.filter((g) => g.sets.some((s) => s.rankings.length > 0));
  if (playedGames.length === 0) {
    return <p className="text-sm text-muted-foreground">Nessun pronostico per questa partita.</p>;
  }
  return (
    <div className="space-y-4">
      {playedGames.map((game) => (
        <div key={game.gameId}>
          <p className="mb-1.5 text-sm font-semibold text-foreground/80">vs {game.opponent}</p>
          <div className="space-y-2">
            {game.sets
              .filter((r) => r.rankings.length > 0)
              .map((r) => (
                <div key={r.setIndex} className="rounded-xl bg-surface-muted px-3.5 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Set {r.setIndex + 1} · <span className="tabular text-foreground">{r.actual.us}–{r.actual.them}</span>
                  </p>
                  <SetRankingBadges rankings={r.rankings} nameById={nameById} />
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
