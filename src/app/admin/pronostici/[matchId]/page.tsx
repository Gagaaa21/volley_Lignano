import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Lock, MapPin, Trophy } from "lucide-react";
import { getActiveRepo, getRepo } from "@/lib/db";
import { requireStaff } from "@/lib/auth/guard";
import { matchTitle } from "@/lib/calendar";
import { formatDateLong } from "@/lib/format";
import { computeMatchResults, isMatchLocked } from "@/lib/predictions";
import { cn } from "@/lib/cn";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import { PredictionForm } from "../PredictionForm";

export const metadata: Metadata = {
  title: "Pronostico",
};

export default async function PredictionPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const session = await requireStaff();
  const repo = await getActiveRepo();
  const match = await repo.getMatch(matchId);
  if (!match) notFound();
  if (match.isTournament) redirect("/admin/pronostici");

  const locked = isMatchLocked(match.matchDate);
  const hasResult = Boolean(match.setScores && match.setScores.length > 0);

  const myPrediction = locked ? null : await repo.getPrediction(matchId, session.sub);

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
        ) : (
          <>
            <CardHeader>
              <h2 className="font-display text-base font-semibold text-foreground">
                {myPrediction ? "Modifica il tuo pronostico" : "Fai il tuo pronostico"}
              </h2>
            </CardHeader>
            <CardBody>
              <PredictionForm matchId={matchId} existing={myPrediction?.setScores ?? null} />
            </CardBody>
          </>
        )}
      </Card>
    </div>
  );
}

/** Una volta bloccata (partita iniziata), i pronostici di tutti diventano
 * visibili — nessuno può più cambiarli, quindi non c'è più nulla da
 * proteggere nascondendoli. Se il risultato reale è già stato inserito,
 * mostra anche chi ha vinto ogni set. */
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

  const results = hasResult ? computeMatchResults(match, predictions) : null;

  if (results) {
    return (
      <div className="space-y-2">
        {results
          .filter((r) => r.rankings.length > 0)
          .map((r) => (
            <div key={r.setIndex} className="rounded-xl border border-border-subtle px-3.5 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
                Set {r.setIndex + 1} · {r.actual.us}-{r.actual.them}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {r.rankings.map((entry) => (
                  <span
                    key={entry.staffId}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                      entry.isWinner
                        ? "bg-[var(--color-u14-soft)] text-[var(--color-u14-strong)]"
                        : "bg-surface-muted text-foreground/60",
                    )}
                  >
                    {entry.isWinner && <Trophy className="h-3 w-3" />}
                    {nameById.get(entry.staffId) ?? "Utente rimosso"}: {entry.predicted.us}-{entry.predicted.them}
                  </span>
                ))}
              </div>
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
        <div
          key={prediction.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-subtle px-3.5 py-2.5"
        >
          <span className="font-medium text-foreground">{nameById.get(prediction.staffId) ?? "Utente rimosso"}</span>
          <span className="text-sm text-foreground/60">
            {prediction.setScores.map((s) => `${s.us}-${s.them}`).join(", ")}
          </span>
        </div>
      ))}
    </div>
  );
}
