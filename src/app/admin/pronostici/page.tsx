import type { Metadata } from "next";
import { MapPin, Target, Trophy } from "lucide-react";
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
import { LinkButton } from "@/components/ui/LinkButton";
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
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Pronostici</h1>
        <p className="mt-1 text-sm text-foreground/60">
          Pronostica il punteggio di ogni set prima che si giochi: chi si avvicina di più vince il set. A fine
          stagione vince chi ha totalizzato più punti.
        </p>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-foreground">
            <Trophy className="h-4 w-4 text-sand-600" />
            Classifica
          </h2>
        </CardHeader>
        <CardBody>
          {leaderboard.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nessun set ancora giudicato: la classifica si popola man mano che arrivano i risultati.
            </p>
          ) : (
            <ol className="space-y-1.5">
              {leaderboard.map((entry, i) => (
                <li
                  key={entry.staffId}
                  className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 odd:bg-surface-muted/60"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sea-100 text-xs font-bold text-sea-800">
                      {i + 1}
                    </span>
                    <span className="truncate font-medium text-foreground">
                      {nameById.get(entry.staffId) ?? "Utente rimosso"}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-foreground/70">
                    {entry.points} {entry.points === 1 ? "punto" : "punti"}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </CardBody>
      </Card>

      <div className="mt-8">
        <h2 className="font-display text-lg font-bold text-foreground">Da pronosticare</h2>
        {upcoming.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-border-subtle bg-surface px-6 py-10 text-center text-sm text-foreground/50">
            Nessuna partita in programma al momento.
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {upcoming.map((match) => {
              const matchPredictions = predictionsByMatch.get(match.id) ?? [];
              const mine = matchPredictions.find((p) => p.staffId === session.sub);
              const count = matchPredictions.length;
              const openToday = isMatchDayToday(match.matchDate);
              return (
                <Card key={match.id}>
                  <CardBody className="flex flex-wrap items-center justify-between gap-4 pt-5">
                    <div className="min-w-0">
                      <p className="font-display text-base font-bold text-foreground">{matchTitle(match)}</p>
                      <p className="mt-1 text-sm text-foreground/60">
                        {formatDateLong(match.matchDate.slice(0, 10))} · {match.matchDate.slice(11, 16)}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-foreground/50">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{match.location}</span>
                      </p>
                      <p className="mt-1 text-xs text-foreground/45">
                        {openToday
                          ? count === 0
                            ? "Nessun pronostico ancora"
                            : `${count} pronostic${count === 1 ? "o" : "i"}`
                          : "Si apre il giorno della partita"}
                      </p>
                    </div>
                    <LinkButton
                      href={`/admin/pronostici/${match.id}`}
                      variant={openToday && mine ? "outline" : openToday ? "primary" : "outline"}
                      size="sm"
                    >
                      <Target className="h-3.5 w-3.5" />
                      {openToday ? (mine ? "Modifica pronostico" : "Pronostica") : "Dettagli"}
                    </LinkButton>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {lockedNoResult.length > 0 && (
        <div className="mt-8">
          <h2 className="font-display text-lg font-bold text-foreground">In attesa del risultato</h2>
          <div className="mt-3 space-y-3">
            {lockedNoResult.map((match) => (
              <Card key={match.id}>
                <CardBody className="flex flex-wrap items-center justify-between gap-4 pt-5">
                  <div className="min-w-0">
                    <p className="font-display text-base font-bold text-foreground">{matchTitle(match)}</p>
                    <p className="mt-1 text-sm text-foreground/60">
                      {formatDateLong(match.matchDate.slice(0, 10))} · {match.matchDate.slice(11, 16)}
                    </p>
                  </div>
                  <LinkButton href={`/admin/pronostici/${match.id}`} variant="outline" size="sm">
                    Vedi pronostici
                  </LinkButton>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      )}

      {withResult.length > 0 && (
        <div className="mt-8">
          <h2 className="font-display text-lg font-bold text-foreground">Risultati</h2>
          <div className="mt-3 space-y-3">
            {withResult.map((match) => (
              <MatchResultCard
                key={match.id}
                match={match}
                predictions={predictionsByMatch.get(match.id) ?? []}
                nameById={nameById}
              />
            ))}
          </div>
        </div>
      )}
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
      <CardHeader>
        <p className="font-display text-base font-bold text-foreground">{matchTitle(match)}</p>
        <p className="mt-1 text-sm text-foreground/60">{formatDateLong(match.matchDate.slice(0, 10))}</p>
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
          <div key={r.setIndex} className="rounded-xl border border-border-subtle px-3.5 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
              Set {r.setIndex + 1} · {r.actual.us}-{r.actual.them}
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
                <div key={r.setIndex} className="rounded-xl border border-border-subtle px-3.5 py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
                    Set {r.setIndex + 1} · {r.actual.us}-{r.actual.them}
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
