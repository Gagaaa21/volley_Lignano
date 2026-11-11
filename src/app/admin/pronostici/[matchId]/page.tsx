import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarClock, Lock, MapPin, Users } from "lucide-react";
import { getActiveRepo, getRepo } from "@/lib/db";
import { requireStaff } from "@/lib/auth/guard";
import { matchTitle } from "@/lib/calendar";
import { formatDateLong } from "@/lib/format";
import {
  arePredictionsClosed,
  computeMatchResults,
  computeTournamentMatchResults,
  matchHasResult,
  PREDICTION_GRACE_LABEL,
  predictionClosingLabel,
} from "@/lib/predictions";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { PageHeader } from "@/components/ui/PageHeader";
import { PredictionForm } from "../PredictionForm";
import { PendingPredictions, PredictionSummary, ResultLegend, ResultTable, WhoPredicted } from "../PredictionViews";
import type { Match, MatchPrediction } from "@/lib/types";

export const metadata: Metadata = {
  title: "Pronostico",
};

export default async function PredictionPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const session = await requireStaff();
  const [repo, staffRepo] = await Promise.all([getActiveRepo(), getRepo()]);
  const [match, predictions, staff] = await Promise.all([repo.getMatch(matchId), repo.listPredictions({ matchId }), staffRepo.listStaff()]);
  if (!match) notFound();

  const nameById = new Map(staff.map((s) => [s.id, s.fullName]));
  const closed = arePredictionsClosed(match);
  const myPrediction = predictions.find((p) => p.staffId === session.sub) ?? null;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        back={{ href: "/admin/pronostici", label: "Pronostici" }}
        eyebrow={
          <span className="inline-flex flex-wrap items-center gap-2">
            <CategoryTag category={match.category} size="md" long />
            {formatDateLong(match.matchDate.slice(0, 10))}
          </span>
        }
        title={matchTitle(match)}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="tabular font-semibold text-foreground/80">{match.matchDate.slice(11, 16)}</span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4 shrink-0" />
              {match.location}
            </span>
          </span>
        }
      />

      {closed ? (
        <Card>
          <CardBody className="pt-5">
            <ClosedPredictions match={match} predictions={predictions} nameById={nameById} meId={session.sub} />
          </CardBody>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <h2 className="font-display text-base font-semibold text-foreground">
                {myPrediction ? "Modifica il tuo pronostico" : "Fai il tuo pronostico"}
              </h2>
              <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted-foreground" data-prediction-deadline>
                <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                Puoi inviarlo o cambiarlo fino a {PREDICTION_GRACE_LABEL} dopo l&apos;inizio: si chiude {predictionClosingLabel(match.matchDate)}.
              </p>
            </CardHeader>
            <CardBody className="space-y-4">
              {myPrediction && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl bg-success-soft/60 px-3.5 py-2.5 text-sm" data-my-saved-prediction>
                  <span className="font-semibold text-success">Salvato:</span>
                  <PredictionSummary prediction={myPrediction} />
                </div>
              )}
              <PredictionForm
                matchId={matchId}
                isTournament={match.isTournament}
                existingSetScores={myPrediction?.setScores ?? null}
                existingTournamentGames={myPrediction?.tournamentGames ?? null}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="flex items-center gap-1.5 font-display text-base font-semibold text-foreground">
                <Users className="h-4 w-4 text-muted-foreground" />
                Chi ha già pronosticato{predictions.length > 0 ? ` (${predictions.length})` : ""}
              </h2>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                I punteggi degli altri si vedono quando i pronostici si chiudono, così nessuno copia.
              </p>
            </CardHeader>
            <CardBody>
              <WhoPredicted staffIds={predictions.map((p) => p.staffId)} nameById={nameById} meId={session.sub} />
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}

/** Chiusi (10 minuti dopo l'inizio, o col risultato già inserito): i pronostici di tutti diventano visibili, nessuno può più
 * cambiarli. Col risultato, la tabella set per set con i punti di ognuno (per i tornei, una per gara). */
function ClosedPredictions({
  match,
  predictions,
  nameById,
  meId,
}: {
  match: Match;
  predictions: MatchPrediction[];
  nameById: Map<string, string>;
  meId: string;
}) {
  if (predictions.length === 0) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Lock className="h-4 w-4 shrink-0" />
        Nessun pronostico è stato inviato per questa partita prima della chiusura.
      </p>
    );
  }

  if (!matchHasResult(match)) {
    return (
      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Lock className="h-4 w-4 shrink-0" />
          Pronostici chiusi: ora si vedono quelli di tutti. I punti arrivano col risultato.
        </p>
        <PendingPredictions predictions={predictions} nameById={nameById} meId={meId} />
      </div>
    );
  }

  if (match.isTournament) {
    const games = (computeTournamentMatchResults(match, predictions) ?? []).filter((g) => g.sets.some((s) => s.rankings.length > 0));
    return (
      <div className="space-y-5">
        {games.map((game) => (
          <ResultTable key={game.gameId} sets={game.sets} nameById={nameById} meId={meId} label={`vs ${game.opponent}`} />
        ))}
        <ResultLegend />
      </div>
    );
  }

  return (
    <div>
      <ResultTable sets={computeMatchResults(match, predictions) ?? []} nameById={nameById} meId={meId} />
      <ResultLegend />
    </div>
  );
}
