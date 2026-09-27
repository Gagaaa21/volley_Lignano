import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, Lock, MapPin } from "lucide-react";
import { getActiveRepo, getRepo } from "@/lib/db";
import { requireStaff } from "@/lib/auth/guard";
import { matchTitle } from "@/lib/calendar";
import { formatDateLong } from "@/lib/format";
import {
  computeMatchResults,
  computeTournamentMatchResults,
  isMatchDayToday,
  isMatchLocked,
  matchHasResult,
} from "@/lib/predictions";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import { PredictionForm } from "../PredictionForm";
import { SetRankingBadges } from "../PredictionRankings";
import type { Match, MatchPrediction } from "@/lib/types";

export const metadata: Metadata = {
  title: "Pronostico",
};

export default async function PredictionPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const session = await requireStaff();
  const repo = await getActiveRepo();
  const match = await repo.getMatch(matchId);
  if (!match) notFound();

  const locked = isMatchLocked(match.matchDate);
  const openToday = !locked && isMatchDayToday(match.matchDate);
  const hasResult = matchHasResult(match);

  const myPrediction = openToday ? await repo.getPrediction(matchId, session.sub) : null;

  return (
    <div className="mx-auto max-w-2xl">
      <LinkButton href="/admin/pronostici" variant="ghost" size="sm" className="mb-4 -ml-3.5">
        <ArrowLeft className="h-4 w-4" />
        Torna ai pronostici
      </LinkButton>

      <h1 className="font-display text-2xl font-bold text-foreground">{matchTitle(match)}</h1>
      <p className="mt-1 text-sm text-foreground/60">
        {formatDateLong(match.matchDate.slice(0, 10))} · {match.matchDate.slice(11, 16)}
      </p>
      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-foreground/50">
        <MapPin className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{match.location}</span>
      </p>

      <Card className="mt-6">
        {locked ? (
          <CardBody className="pt-5">
            <LockedPredictions matchId={matchId} hasResult={hasResult} />
          </CardBody>
        ) : openToday ? (
          <>
            <CardHeader>
              <h2 className="font-display text-base font-semibold text-foreground">
                {myPrediction ? "Modifica il tuo pronostico" : "Fai il tuo pronostico"}
              </h2>
            </CardHeader>
            <CardBody>
              <PredictionForm
                matchId={matchId}
                isTournament={match.isTournament}
                existingSetScores={myPrediction?.setScores ?? null}
                existingTournamentGames={myPrediction?.tournamentGames ?? null}
              />
            </CardBody>
          </>
        ) : (
          <CardBody className="pt-5">
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarClock className="h-4 w-4 shrink-0" />
              Potrai pronosticare a partire dal giorno stesso della partita ({formatDateLong(match.matchDate.slice(0, 10))}).
            </p>
          </CardBody>
        )}
      </Card>
    </div>
  );
}

/** Una volta bloccata (partita iniziata), i pronostici di tutti diventano
 * visibili — nessuno può più cambiarli, quindi non c'è più nulla da
 * proteggere nascondendoli. Se il risultato reale è già stato inserito,
 * mostra anche chi ha vinto ogni set (raggruppati per avversaria, per i
 * tornei). */
async function LockedPredictions({ matchId, hasResult }: { matchId: string; hasResult: boolean }) {
  const [repo, staffRepo] = await Promise.all([getActiveRepo(), getRepo()]);
  const [match, predictions, staff] = await Promise.all([
    repo.getMatch(matchId),
    repo.listPredictions({ matchId }),
    staffRepo.listStaff(),
  ]);
  if (!match) notFound();

  const nameById = new Map(staff.map((s) => [s.id, s.fullName]));

  if (predictions.length === 0) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Lock className="h-4 w-4 shrink-0" />
        Nessun pronostico è stato inviato per questa partita prima che iniziasse.
      </p>
    );
  }

  if (hasResult && match.isTournament) {
    const gameResults = computeTournamentMatchResults(match, predictions) ?? [];
    const playedGames = gameResults.filter((g) => g.sets.some((s) => s.rankings.length > 0));
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

  if (hasResult) {
    const results = computeMatchResults(match, predictions) ?? [];
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

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Lock className="h-4 w-4 shrink-0" />
        In attesa del risultato — i pronostici sono comunque bloccati e visibili a tutti.
      </p>
      {predictions.map((prediction) => (
        <PredictionSummaryRow key={prediction.id} prediction={prediction} match={match} nameById={nameById} />
      ))}
    </div>
  );
}

function PredictionSummaryRow({
  prediction,
  match,
  nameById,
}: {
  prediction: MatchPrediction;
  match: Match;
  nameById: Map<string, string>;
}) {
  if (match.isTournament) {
    return (
      <div className="rounded-xl border border-border-subtle px-3.5 py-2.5">
        <p className="font-medium text-foreground">{nameById.get(prediction.staffId) ?? "Utente rimosso"}</p>
        <div className="mt-1 space-y-0.5">
          {(prediction.tournamentGames ?? []).map((g) => (
            <p key={g.id} className="text-sm text-foreground/60">
              vs {g.opponent}: {g.setScores.map((s) => `${s.us}-${s.them}`).join(", ")}
            </p>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-subtle px-3.5 py-2.5">
      <span className="font-medium text-foreground">{nameById.get(prediction.staffId) ?? "Utente rimosso"}</span>
      <span className="text-sm text-foreground/60">
        {(prediction.setScores ?? []).map((s) => `${s.us}-${s.them}`).join(", ")}
      </span>
    </div>
  );
}
